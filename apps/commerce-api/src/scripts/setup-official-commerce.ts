import { readFileSync } from "node:fs";
import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createLocationFulfillmentSetWorkflow,
  createRegionsWorkflow,
  createServiceZonesWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import {
  createOffersWorkflow,
  createSellerShippingOptionsWorkflow,
  createSellerStockLocationsWorkflow,
} from "@mercurjs/core/workflows";

/**
 * Configures the official AgeStyles store in production: USD store currency, the Cuba
 * region, its stock location, pickup/delivery shipping options and one offer per
 * imported product listed in a private offer plan (see
 * tools/migration/build-official-offer-plan.mjs). Every step is idempotent.
 *
 * Without AGESTYLES_OFFICIAL_COMMERCE_APPLY=true it only reports what it would do.
 */

const OFFICIAL_EXTERNAL_ID = "agestyles-official";
const REGION_NAME = "Cuba";
const COUNTRY = "cu";
const CURRENCY = "usd";
const PICKUP_NAME = "Recogida en tienda";
const DELIVERY_NAME = "Entrega a domicilio";

type PlanOffer = {
  product_external_id: string;
  legacy_code: string;
  title: string;
  usd: number;
  stock: number;
  option_title: string | null;
  variant_label: string | null;
};
type Plan = {
  format: string;
  version: number;
  currency_code: string;
  delivery_usd: number;
  location: { name: string; city: string; country_code: string; address_1: string };
  offers: PlanOffer[];
};
type ProductRow = {
  id: string;
  external_id: string;
  options?: { id: string; title: string; values?: { id: string; value: string }[] }[];
  variants?: { id: string; title: string }[];
};

function isAlreadyLinked(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("already");
}

function offerSku(code: string) {
  return `AGS-OF-${code}`;
}

export default async function setupOfficialCommerce({ container }: ExecArgs) {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.AGESTYLES_COMMERCE_ENV !== "production" ||
    databaseUrl.host !== "127.0.0.1:15473" ||
    databaseUrl.username !== "agestyles_production" ||
    databaseUrl.pathname !== "/agestyles_commerce"
  ) {
    throw new Error("Este comando requiere la base de producción de AgeStyles.");
  }
  const apply = process.env.AGESTYLES_OFFICIAL_COMMERCE_APPLY === "true";
  const planPath = process.env.AGESTYLES_OFFICIAL_OFFER_PLAN;
  if (!planPath) throw new Error("Configura AGESTYLES_OFFICIAL_OFFER_PLAN.");
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as Plan;
  if (plan.format !== "agestyles-official-offer-plan" || plan.version !== 1) {
    throw new Error("El plan de ofertas no tiene el formato esperado.");
  }
  if (plan.currency_code !== CURRENCY || !(plan.delivery_usd >= 0)) {
    throw new Error("El plan debe usar USD y un precio de entrega válido.");
  }
  for (const offer of plan.offers) {
    if (!(offer.usd > 0) || !Number.isInteger(offer.stock) || offer.stock < 0) {
      throw new Error(`Oferta inválida en el plan: ${offer.legacy_code}`);
    }
  }
  const ownerEmail = process.env.AGESTYLES_OFFICIAL_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) throw new Error("Configura AGESTYLES_OFFICIAL_OWNER_EMAIL.");

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const productService = container.resolve(Modules.PRODUCT);
  const report: Record<string, unknown> = { mode: apply ? "apply" : "dry-run" };

  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "status", "external_id"],
    filters: { external_id: OFFICIAL_EXTERNAL_ID },
  });
  const seller = sellers[0] as { id: string; status: string } | undefined;
  if (sellers.length !== 1 || !seller || seller.status !== "open") {
    throw new Error("La tienda oficial debe existir y estar abierta.");
  }
  const { data: members } = await query.graph({
    entity: "member",
    fields: ["id"],
    filters: { email: ownerEmail },
  });
  if (members.length !== 1) throw new Error("No se encontró al titular de la tienda oficial.");
  const memberId = (members[0] as { id: string }).id;

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "name", "supported_currencies.currency_code", "supported_currencies.is_default"],
  });
  const store = stores[0] as {
    id: string;
    name: string;
    supported_currencies?: { currency_code: string; is_default: boolean }[];
  };
  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
    filters: { name: "Default Sales Channel" },
  });
  const channel = channels[0] as { id: string } | undefined;
  if (!store || !channel) throw new Error("Falta la tienda base o el canal de venta.");
  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "type"],
    filters: { type: "default" },
  });
  const profile = profiles[0] as { id: string } | undefined;
  if (!profile) throw new Error("Falta el perfil de envío por defecto.");

  // Products in the plan, with their single imported variant.
  const { data: productRows } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "external_id",
      "options.id",
      "options.title",
      "options.values.id",
      "options.values.value",
      "variants.id",
      "variants.title",
    ],
    filters: { external_id: plan.offers.map((offer) => offer.product_external_id) },
  });
  const products = new Map(
    (productRows as ProductRow[]).map((product) => [product.external_id, product]),
  );
  for (const offer of plan.offers) {
    const product = products.get(offer.product_external_id);
    if (!product || product.variants?.length !== 1) {
      throw new Error(`El producto ${offer.legacy_code} no tiene exactamente una variante.`);
    }
  }

  const { data: existingOffers } = await query.graph({
    entity: "offer",
    fields: ["id", "sku"],
    filters: { seller_id: seller.id },
  });
  const existingSkus = new Set((existingOffers as { sku: string }[]).map((offer) => offer.sku));
  const pendingOffers = plan.offers.filter(
    (offer) => !existingSkus.has(offerSku(offer.legacy_code)),
  );
  report.offers_planned = plan.offers.length;
  report.offers_existing = plan.offers.length - pendingOffers.length;
  report.offers_to_create = pendingOffers.length;
  report.stock_units = pendingOffers.reduce((sum, offer) => sum + offer.stock, 0);

  if (!apply) {
    report.store_currencies = store.supported_currencies?.map((currency) => currency.currency_code);
    console.log(JSON.stringify(report));
    return;
  }

  // 1. Store: USD only, named AgeStyles, default sales channel.
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "AgeStyles",
        default_sales_channel_id: channel.id,
        supported_currencies: [{ currency_code: CURRENCY, is_default: true }],
      },
    },
  });

  // 2. Region and tax region for Cuba.
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "countries.iso_2"],
  });
  let region = (regions as { id: string; countries?: { iso_2: string }[] }[]).find((item) =>
    item.countries?.some((country) => country.iso_2 === COUNTRY),
  );
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: CURRENCY,
            countries: [COUNTRY],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    region = result[0];
  }
  if (!region) throw new Error("No se pudo crear la región de Cuba.");
  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
    filters: { country_code: COUNTRY },
  });
  if (!taxRegions.length) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: COUNTRY, provider_id: "tp_system" }],
    });
  }

  // 3. Publishable key sees the default sales channel.
  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: { type: "publishable" },
  });
  for (const key of keys as { id: string }[]) {
    try {
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: key.id, add: [channel.id] },
      });
    } catch (error) {
      if (!isAlreadyLinked(error)) throw error;
    }
  }

  // 4. Official stock location with a Cuba service zone.
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_sets.id"],
    filters: { name: plan.location.name },
  });
  let locationId = (locations[0] as { id: string } | undefined)?.id;
  if (!locationId) {
    const { result } = await createSellerStockLocationsWorkflow(container).run({
      input: {
        seller_id: seller.id,
        locations: [
          {
            name: plan.location.name,
            address: {
              city: plan.location.city,
              country_code: plan.location.country_code,
              address_1: plan.location.address_1,
            },
          },
        ],
      },
    });
    locationId = result[0]?.id;
  }
  if (!locationId) throw new Error("No se pudo crear la ubicación de stock oficial.");

  const fulfillmentSetId = async () => {
    const { data } = await query.graph({
      entity: "stock_location",
      fields: ["fulfillment_sets.id"],
      filters: { id: locationId },
    });
    return (data[0] as { fulfillment_sets?: { id: string }[] } | undefined)?.fulfillment_sets?.[0]
      ?.id;
  };
  let setId = await fulfillmentSetId();
  if (!setId) {
    await createLocationFulfillmentSetWorkflow(container).run({
      input: {
        location_id: locationId,
        fulfillment_set_data: { name: "AgeStyles Oficial — Entregas", type: "shipping" },
      },
    });
    setId = await fulfillmentSetId();
  }
  if (!setId) throw new Error("No se pudo crear el conjunto de entregas.");

  const { data: zones } = await query.graph({
    entity: "service_zone",
    fields: ["id"],
    filters: { fulfillment_set_id: setId },
  });
  let serviceZoneId = (zones[0] as { id: string } | undefined)?.id;
  if (!serviceZoneId) {
    const { result } = await createServiceZonesWorkflow(container).run({
      input: {
        data: [
          {
            fulfillment_set_id: setId,
            name: "AgeStyles Oficial — Cuba",
            geo_zones: [{ country_code: COUNTRY, type: "country" }],
          },
        ],
      },
    });
    serviceZoneId = result[0]?.id;
  }
  if (!serviceZoneId) throw new Error("No se pudo crear la zona de servicio.");

  try {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    });
  } catch (error) {
    if (!isAlreadyLinked(error)) throw error;
  }
  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: locationId, add: [channel.id] },
    });
  } catch (error) {
    if (!isAlreadyLinked(error)) throw error;
  }

  // 5. Pickup and home delivery.
  const shippingOptions = [
    {
      name: PICKUP_NAME,
      amount: 0,
      type: { label: "Recogida", description: "Recoge tu pedido en la tienda.", code: "pickup" },
    },
    {
      name: DELIVERY_NAME,
      amount: plan.delivery_usd,
      type: { label: "A domicilio", description: "Entrega en tu dirección.", code: "delivery" },
    },
  ];
  const { data: existingShipping } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "service_zone_id"],
    filters: { service_zone_id: serviceZoneId },
  });
  const existingShippingNames = new Set(
    (existingShipping as { name: string }[]).map((option) => option.name),
  );
  const missingShipping = shippingOptions.filter(
    (option) => !existingShippingNames.has(option.name),
  );
  if (missingShipping.length) {
    await createSellerShippingOptionsWorkflow(container).run({
      input: {
        seller_id: seller.id,
        shipping_options: missingShipping.map((option) => ({
          name: option.name,
          price_type: "flat" as const,
          provider_id: "manual_manual",
          service_zone_id: serviceZoneId,
          shipping_profile_id: profile.id,
          type: option.type,
          prices: [
            { currency_code: CURRENCY, amount: option.amount },
            { region_id: region.id, amount: option.amount },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
            { attribute: "is_return", value: "false", operator: "eq" as const },
          ],
        })),
      },
    });
  }

  // 6. Turn the single imported variant into the sized variant that holds stock.
  let renamedVariants = 0;
  for (const offer of plan.offers) {
    if (!offer.variant_label || !offer.option_title) continue;
    const product = products.get(offer.product_external_id)!;
    const option = product.options?.[0];
    const value = option?.values?.[0];
    const variant = product.variants![0];
    if (!option || !value || product.options!.length !== 1 || option.values!.length !== 1) {
      throw new Error(`El producto ${offer.legacy_code} tiene opciones inesperadas.`);
    }
    if (variant.title === offer.variant_label) continue;
    await productService.updateProductOptions(option.id, { title: offer.option_title });
    await productService.updateProductOptionValues(value.id, { value: offer.variant_label });
    await productService.updateProductVariants(variant.id, { title: offer.variant_label });
    renamedVariants += 1;
  }
  report.renamed_variants = renamedVariants;

  // 7. One offer per product with its stock at the official location.
  for (const offer of pendingOffers) {
    const product = products.get(offer.product_external_id)!;
    const sku = offerSku(offer.legacy_code);
    await createOffersWorkflow(container).run({
      input: {
        offers: [
          {
            seller_id: seller.id,
            created_by: memberId,
            sku,
            variant_id: product.variants![0].id,
            shipping_profile_id: profile.id,
            manage_inventory: true,
            inventory_items: [
              {
                sku,
                title: offer.variant_label
                  ? `${offer.title} — ${offer.variant_label}`
                  : offer.title,
                stock_levels: [{ location_id: locationId, stocked_quantity: offer.stock }],
              },
            ],
            prices: [{ amount: offer.usd, currency_code: CURRENCY }],
            metadata: { agestyles_legacy_code: offer.legacy_code },
          },
        ],
      },
    });
  }
  report.region_id = region.id;
  report.stock_location_id = locationId;
  report.shipping_options_created = missingShipping.map((option) => option.name);
  console.log(JSON.stringify(report));
}
