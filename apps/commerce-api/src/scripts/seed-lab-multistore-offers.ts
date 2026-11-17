import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createOffersWorkflow,
  createSellerShippingOptionsWorkflow,
  createSellerStockLocationsWorkflow,
} from "@mercurjs/core/workflows"
import {
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

const LAB_SELLERS = [
  { handle: "agestyles-lab-a2", ownerEmail: "seller@mercur.dev", suffix: "A2" },
  { handle: "agestyles-lab-b2", ownerEmail: "kickz@mercur.dev", suffix: "B2" },
]
const FIXTURE = "multi-store-v1"
const PRODUCT_HANDLE = "meridian-twin-strap-buckle-sandal"

export default async function seedLabMultistoreOffers({ container }: ExecArgs) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is required")
  const database = new URL(databaseUrl)
  if (
    database.hostname !== "127.0.0.1" ||
    database.port !== "15472" ||
    database.pathname !== "/agestyles_mercur_lab"
  ) {
    throw new Error("Refusing to seed outside the isolated Mercur lab")
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel) throw new Error("Default sales channel is missing from the lab")
  const { data: [profile] } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    filters: { name: "Marketplace Shipping" },
  })
  if (!profile) throw new Error("Seed the Mercur lab catalog before running this fixture")
  const { data: [region] } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { currency_code: "eur" },
  })
  if (!region) throw new Error("The EUR region is missing from the lab")

  const { data: [product] } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })
  const productVariants = (product as { variants?: { id: string; sku?: string }[] } | undefined)?.variants
  const variant = productVariants?.[0]
  if (!product || !variant) throw new Error(`Common product ${PRODUCT_HANDLE} is unavailable`)

  for (const fixture of LAB_SELLERS) {
    const { data: sellers } = await query.graph({
      entity: "seller",
      fields: ["id", "handle", "status", "metadata"],
      filters: { handle: fixture.handle },
    })
    if (sellers.length !== 1) throw new Error(`Expected exactly one seller ${fixture.handle}`)
    const seller = sellers[0] as {
      id: string
      handle: string
      status: string
      metadata?: Record<string, unknown> | null
    }
    if (seller.metadata?.agestyles_lab_fixture !== FIXTURE || seller.status !== "open") {
      throw new Error(`Seller ${fixture.handle} is not an open, marked lab fixture`)
    }

    const { data: members } = await query.graph({
      entity: "member",
      fields: ["id"],
      filters: { email: fixture.ownerEmail },
    })
    if (members.length !== 1) throw new Error(`Expected one owner member for ${fixture.handle}`)

    const locationName = `AgeStyles Lab ${fixture.suffix} Test Warehouse`
    const { data: existingLocations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
      filters: { name: locationName },
    })
    let locationId = (existingLocations[0] as { id: string } | undefined)?.id
    if (!locationId) {
      const { result: locations } = await createSellerStockLocationsWorkflow(container).run({
        input: {
          seller_id: seller.id,
          locations: [{
            name: locationName,
            address: {
              city: "Madrid",
              country_code: "es",
              address_1: "AgeStyles isolated commerce lab",
            },
          }],
        },
      })
      locationId = locations[0]?.id
    }
    if (!locationId) throw new Error(`Could not provision stock location for ${fixture.handle}`)

    const { data: [location] } = await query.graph({
      entity: "stock_location",
      fields: ["id", "fulfillment_sets.id"],
      filters: { id: locationId },
    })
    let fulfillmentSetId = (location as { fulfillment_sets?: { id: string }[] } | undefined)
      ?.fulfillment_sets?.[0]?.id
    if (!fulfillmentSetId) {
      await createLocationFulfillmentSetWorkflow(container).run({
        input: {
          location_id: locationId,
          fulfillment_set_data: {
            name: `AgeStyles Lab ${fixture.suffix} Test Delivery`,
            type: "shipping",
          },
        },
      })
      const { data: [updatedLocation] } = await query.graph({
        entity: "stock_location",
        fields: ["id", "fulfillment_sets.id"],
        filters: { id: locationId },
      })
      fulfillmentSetId = (updatedLocation as { fulfillment_sets?: { id: string }[] } | undefined)
        ?.fulfillment_sets?.[0]?.id
    }
    if (!fulfillmentSetId) throw new Error(`No fulfillment set for ${fixture.handle}`)

    const { data: existingZones } = await query.graph({
      entity: "service_zone",
      fields: ["id"],
      filters: { fulfillment_set_id: fulfillmentSetId },
    })
    let serviceZoneId = (existingZones[0] as { id: string } | undefined)?.id
    if (!serviceZoneId) {
      const { result: zones } = await createServiceZonesWorkflow(container).run({
        input: {
          data: [{
            fulfillment_set_id: fulfillmentSetId,
            name: `AgeStyles Lab ${fixture.suffix} Spain`,
            geo_zones: [{ country_code: "es", type: "country" }],
          }],
        },
      })
      serviceZoneId = zones[0]?.id
    }
    if (!serviceZoneId) throw new Error(`No service zone for ${fixture.handle}`)

    try {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
      })
    } catch (error) {
      if (!(error instanceof Error && error.message.toLowerCase().includes("already"))) throw error
    }
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: locationId, add: [defaultSalesChannel.id] },
      })
    } catch (error) {
      if (!(error instanceof Error && error.message.toLowerCase().includes("already"))) throw error
    }

    const sku = `AGESTYLES-LAB-${fixture.suffix}-COMMON-01`
    const { data: existingOffers } = await query.graph({
      entity: "offer",
      fields: ["id", "sku"],
      filters: { seller_id: seller.id, sku },
    })
    if (!existingOffers.length) {
      await createOffersWorkflow(container).run({
        input: {
          offers: [{
            seller_id: seller.id,
            created_by: members[0].id,
            sku,
            variant_id: variant.id,
            shipping_profile_id: profile.id,
            inventory_items: [{
              sku,
              stock_levels: [{ location_id: locationId, stocked_quantity: 25 }],
            }],
            prices: [{ amount: 49, currency_code: "eur" }],
          }],
        },
      })
      console.info(`Seeded common-product offer and 25 stock units for ${fixture.handle}`)
    }

    if (fixture.suffix === "B2") {
      const secondVariant = productVariants?.[1]
      if (!secondVariant) throw new Error("The common product needs at least two variants for the mixed-cart test")
      const secondSku = `AGESTYLES-LAB-B2-COMMON-02`
      const { data: existingSecondOffer } = await query.graph({
        entity: "offer",
        fields: ["id"],
        filters: { seller_id: seller.id, sku: secondSku },
      })
      if (!existingSecondOffer.length) {
        await createOffersWorkflow(container).run({
          input: {
            offers: [{
              seller_id: seller.id,
              created_by: members[0].id,
              sku: secondSku,
              variant_id: secondVariant.id,
              shipping_profile_id: profile.id,
              inventory_items: [{
                sku: secondSku,
                stock_levels: [{ location_id: locationId, stocked_quantity: 25 }],
              }],
              prices: [{ amount: 51, currency_code: "eur" }],
            }],
          },
        })
        console.info(`Seeded second-size offer and 25 stock units for ${fixture.handle}`)
      }
    }

    const shippingName = `AgeStyles Lab ${fixture.suffix} Standard Shipping`
    const { data: existingShippingOptions } = await query.graph({
      entity: "shipping_option",
      fields: ["id"],
      filters: { name: shippingName },
    })
    if (!existingShippingOptions.length) {
      await createSellerShippingOptionsWorkflow(container).run({
        input: {
          seller_id: seller.id,
          shipping_options: [{
            name: shippingName,
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: serviceZoneId,
            shipping_profile_id: profile.id,
            type: {
              label: "Standard",
              description: "AgeStyles isolated lab test delivery.",
              code: "standard",
            },
            prices: [
              { currency_code: "eur", amount: 7 },
              { region_id: region.id, amount: 7 },
            ],
            rules: [
              { attribute: "enabled_in_store", value: "true", operator: "eq" },
              { attribute: "is_return", value: "false", operator: "eq" },
            ],
          }],
        },
      })
    }
  }
}
