import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  batchLinksWorkflow,
  createCustomersWorkflow,
  createLocationFulfillmentSetWorkflow,
  createProductCategoriesWorkflow,
  createServiceZonesWorkflow,
  deleteCustomersWorkflow,
  deleteFulfillmentSetsWorkflow,
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
  deleteShippingOptionsWorkflow,
  deleteStockLocationsWorkflow,
  linkProductsToSalesChannelWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";
import {
  acceptMemberInviteWorkflow,
  approveSellerWorkflow,
  confirmProductChangeWorkflow,
  createMemberInvitesWorkflow,
  createOffersWorkflow,
  createProductsWorkflow,
  createSellerAccountWorkflow,
  createSellerShippingOptionsWorkflow,
  createSellerStockLocationsWorkflow,
  deleteOffersWorkflow,
  deleteSellersWorkflow,
} from "@mercurjs/core/workflows";
import {
  AGESTYLES_SALES_COMMISSIONS_MODULE,
  type SalesCommissionsService,
} from "@agestyles/sales-commissions";
import {
  DEMO_CATEGORIES,
  DEMO_CUSTOMERS,
  DEMO_MARKER,
  DEMO_PREFIX,
  DEMO_STORES,
  demoEmail,
  type DemoProduct,
} from "./demo-stores-data";

/**
 * Demo marketplace (AG-33): five fictional stores to try every screen, created **hidden**:
 * the stores stay pending approval and their products «en revisión», so nothing reaches
 * Tienda or Catálogo. Categories are internal. Everything carries `agestyles_demo`.
 *
 *   AGESTYLES_DEMO_ACTION=report   what exists (default, read only)
 *   AGESTYLES_DEMO_ACTION=seed     create what is missing (idempotent)
 *   AGESTYLES_DEMO_ACTION=publish  make the demo public: approve the stores, approve their
 *                                  products, show the categories and (optionally) replace
 *                                  the photos with AGESTYLES_DEMO_PHOTOS_DIR/<store>-<product>.jpg|png
 *   AGESTYLES_DEMO_ACTION=cleanup  remove every demo record
 *
 * seed and cleanup need AGESTYLES_DEMO_CONFIRM=yes. Seed prints one line starting with
 * DEMO_CREDENTIAL (emails and generated passwords of the demo accounts): redirect it to a
 * private file. Optional AGESTYLES_DEMO_IMAGES_DIR holds `<store>-<product>.png` photos.
 */

type Query = {
  graph(input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }): Promise<{ data: Record<string, any>[] }>;
};

const CURRENCY = "usd";
const COUNTRY = "cu";
const externalId = (...parts: string[]) => [DEMO_PREFIX, ...parts].join("-");
const handleOf = (...parts: string[]) => ["demo", ...parts].join("-");
const marker = { [DEMO_MARKER]: true };
const password = () => `Demo-${randomBytes(9).toString("base64url")}`;

function isAlreadyLinked(error: unknown) {
  return /already exists|duplicate/i.test(String((error as Error)?.message ?? error));
}

async function demoState(query: Query) {
  const [sellers, products, categories, customers] = await Promise.all([
    query.graph({ entity: "seller", fields: ["id", "name", "handle", "status", "external_id"] }),
    query.graph({ entity: "product", fields: ["id", "external_id", "status"] }),
    query.graph({ entity: "product_category", fields: ["id", "handle", "metadata"] }),
    query.graph({ entity: "customer", fields: ["id", "email", "metadata"] }),
  ]);
  const isDemo = (row: Record<string, any>) =>
    String(row.external_id ?? "").startsWith(DEMO_PREFIX) || row.metadata?.[DEMO_MARKER] === true;
  return {
    sellers: sellers.data.filter(isDemo),
    products: products.data.filter(isDemo),
    categories: categories.data.filter(isDemo),
    customers: customers.data.filter(isDemo),
  };
}

export default async function demoStores({ container }: ExecArgs) {
  const action = process.env.AGESTYLES_DEMO_ACTION ?? "report";
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as unknown as Query;
  const before = await demoState(query);
  const summary = (state: typeof before) => ({
    sellers: state.sellers.map((seller) => `${seller.name} [${seller.status}]`),
    products: state.products.length,
    published_products: state.products.filter((product) => product.status === "published").length,
    categories: state.categories.length,
    customers: state.customers.length,
  });

  if (action === "report") {
    console.log(JSON.stringify({ action, ...summary(before) }));
    return;
  }
  if (process.env.AGESTYLES_DEMO_CONFIRM !== "yes") {
    throw new Error(
      "Añade AGESTYLES_DEMO_CONFIRM=yes para crear o borrar los datos de demostración.",
    );
  }
  if (action === "cleanup") {
    await cleanup(container, query, before);
  } else if (action === "seed") {
    await seed(container, query);
  } else if (action === "publish") {
    await publish(container, query, before);
  } else {
    throw new Error("AGESTYLES_DEMO_ACTION debe ser report, seed, publish o cleanup.");
  }
  console.log(JSON.stringify({ action, ...summary(await demoState(query)) }));
}

async function seed(container: ExecArgs["container"], query: Query) {
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const auth = container.resolve(Modules.AUTH);
  const file = container.resolve(Modules.FILE);
  const commissions = container.resolve<SalesCommissionsService>(
    AGESTYLES_SALES_COMMISSIONS_MODULE,
  );
  // Printed as soon as each account exists, so a failed run never loses a password.
  const credentials = {
    push(entry: { store: string; role: string; email: string; password: string }) {
      console.log(`DEMO_CREDENTIAL ${JSON.stringify(entry)}`);
    },
  };
  const imagesDir = process.env.AGESTYLES_DEMO_IMAGES_DIR;

  const [{ data: channels }, { data: profiles }, { data: regions }] = await Promise.all([
    query.graph({ entity: "sales_channel", fields: ["id"] }),
    query.graph({ entity: "shipping_profile", fields: ["id", "type"] }),
    query.graph({ entity: "region", fields: ["id", "countries.iso_2"] }),
  ]);
  const channel = channels[0];
  const profile = profiles.find((item) => item.type === "default") ?? profiles[0];
  const region = regions.find((item) =>
    (item.countries ?? []).some((country: { iso_2: string }) => country.iso_2 === COUNTRY),
  );
  if (!channel || !profile || !region) {
    throw new Error("Faltan el canal de venta, el perfil de envío o la región de Cuba.");
  }

  // Categories: internal, so the public store and catalog never list them.
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  });
  const categoryIds = new Map(
    existingCategories.map((category) => [category.handle as string, category.id as string]),
  );
  for (const category of DEMO_CATEGORIES) {
    const handle = handleOf(category.slug);
    if (categoryIds.has(handle)) continue;
    const parentId = category.parent ? categoryIds.get(handleOf(category.parent)) : undefined;
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name: category.name,
            handle,
            description: category.description,
            is_active: true,
            is_internal: true,
            ...(parentId ? { parent_category_id: parentId } : {}),
            metadata: marker,
          },
        ],
      },
    });
    categoryIds.set(handle, result[0].id);
  }

  // Demo customers (no sign-in), to see them in the administration.
  const { data: customers } = await query.graph({ entity: "customer", fields: ["id", "email"] });
  const customerEmails = new Set(customers.map((customer) => customer.email));
  const newCustomers = DEMO_CUSTOMERS.filter(
    (customer) => !customerEmails.has(demoEmail(customer.slug)),
  );
  if (newCustomers.length) {
    await createCustomersWorkflow(container).run({
      input: {
        customersData: newCustomers.map((customer) => ({
          email: demoEmail(customer.slug),
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
          metadata: marker,
        })),
      },
    });
  }

  for (const store of DEMO_STORES) {
    const storeExternalId = externalId(store.slug);
    const ownerEmail = demoEmail(store.slug);
    const { data: found } = await query.graph({
      entity: "seller",
      fields: ["id", "members.id"],
      filters: { external_id: storeExternalId },
    });
    let seller = found[0] as { id: string } | undefined;

    if (!seller) {
      const ownerPassword = password();
      const registration = await auth.register("emailpass", {
        body: { email: ownerEmail, password: ownerPassword },
      });
      if (!registration.success || !registration.authIdentity?.id) {
        throw new Error(`No se pudo registrar al dueño de ${store.name}.`);
      }
      const { result } = await createSellerAccountWorkflow(container).run({
        input: {
          auth_identity_id: registration.authIdentity.id,
          member_email: ownerEmail,
          first_name: store.owner.first_name,
          last_name: store.owner.last_name,
          seller: {
            name: store.name,
            handle: handleOf(store.slug),
            email: ownerEmail,
            phone: store.phone,
            description: store.description,
            currency_code: CURRENCY,
            external_id: storeExternalId,
            metadata: marker,
          } as never,
        },
      });
      // Not approved on purpose: a pending store stays out of the public marketplace.
      seller = { id: (result as { id: string }).id };
      credentials.push({
        store: store.name,
        role: "Propietario",
        email: ownerEmail,
        password: ownerPassword,
      });
    }
    const sellerId = seller.id;

    const { data: memberRows } = await query.graph({
      entity: "seller_member",
      fields: ["id", "is_owner", "member.id", "member.email"],
      filters: { seller_id: sellerId },
    });
    const ownerMemberId = memberRows.find((row) => row.is_owner)?.member?.id as string;
    const memberEmails = new Set(memberRows.map((row) => row.member?.email));

    // Team members with their roles (and a sales agent with a commission rule).
    for (const person of store.members ?? []) {
      const email = demoEmail(person.slug);
      if (!memberEmails.has(email)) {
        const memberPassword = password();
        const registration = await auth.register("emailpass", {
          body: { email, password: memberPassword },
        });
        if (!registration.success || !registration.authIdentity?.id) {
          throw new Error(`No se pudo registrar a ${email}.`);
        }
        const { result: invites } = await createMemberInvitesWorkflow(container).run({
          input: [{ seller_id: sellerId, email, role_id: person.role_id }],
        });
        await acceptMemberInviteWorkflow(container).run({
          input: {
            invite_token: (invites as { token?: string }[])[0].token as string,
            auth_identity_id: registration.authIdentity.id,
            first_name: person.first_name,
            last_name: person.last_name,
          },
        });
        credentials.push({
          store: store.name,
          role: person.role_id,
          email,
          password: memberPassword,
        });
      }
      if (person.agent_code) {
        const { data: rows } = await query.graph({
          entity: "seller_member",
          fields: ["member.id", "member.email"],
          filters: { seller_id: sellerId },
        });
        const memberId = rows.find((row) => row.member?.email === email)?.member?.id as string;
        const agents = await commissions.listSalesAgents({ seller_id: sellerId });
        if (!agents.length && memberId) {
          await commissions.createSalesAgents({
            seller_id: sellerId,
            member_id: memberId,
            member_email: email,
            code: person.agent_code,
            active: true,
          } as never);
        }
      }
    }
    if (store.commission_percent) {
      const rules = await commissions.listCommissionRules({ seller_id: sellerId });
      if (!rules.length) {
        await commissions.createCommissionRules({
          seller_id: sellerId,
          product_id: null,
          kind: "percent",
          value: store.commission_percent,
          unit_threshold: null,
        } as never);
      }
    }

    // Stock location, delivery area and the two shipping options.
    const locationName = `${store.name} — Almacén`;
    const { data: locations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "fulfillment_sets.id", "fulfillment_sets.service_zones.id"],
      filters: { name: locationName },
    });
    let locationId = locations[0]?.id as string | undefined;
    if (!locationId) {
      const { result } = await createSellerStockLocationsWorkflow(container).run({
        input: {
          seller_id: sellerId,
          locations: [
            {
              name: locationName,
              address: { city: store.city, country_code: COUNTRY, address_1: store.address },
              metadata: marker,
            } as never,
          ],
        },
      });
      locationId = (result as { id: string }[])[0].id;
    }
    const zoneOf = async () => {
      const { data } = await query.graph({
        entity: "stock_location",
        fields: ["fulfillment_sets.id", "fulfillment_sets.service_zones.id"],
        filters: { id: locationId },
      });
      const set = data[0]?.fulfillment_sets?.[0];
      return {
        setId: set?.id as string | undefined,
        zoneId: set?.service_zones?.[0]?.id as string | undefined,
      };
    };
    let { setId, zoneId } = await zoneOf();
    if (!setId) {
      await createLocationFulfillmentSetWorkflow(container).run({
        input: {
          location_id: locationId,
          fulfillment_set_data: { name: `${store.name} — Entregas`, type: "shipping" },
        },
      });
      ({ setId, zoneId } = await zoneOf());
    }
    if (!zoneId && setId) {
      const { result } = await createServiceZonesWorkflow(container).run({
        input: {
          data: [
            {
              fulfillment_set_id: setId,
              name: `${store.name} — Cuba`,
              geo_zones: [{ country_code: COUNTRY, type: "country" }],
            },
          ],
        },
      });
      zoneId = result[0].id;
    }
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
    const { data: shipping } = await query.graph({
      entity: "shipping_option",
      fields: ["id"],
      filters: { service_zone_id: zoneId },
    });
    if (!shipping.length) {
      await createSellerShippingOptionsWorkflow(container).run({
        input: {
          seller_id: sellerId,
          shipping_options: [
            {
              name: "Recogida en tienda",
              amount: 0,
              code: "pickup",
              label: "Recogida",
              description: "Recoge tu pedido en la tienda.",
            },
            {
              name: "Entrega a domicilio",
              amount: store.delivery_usd,
              code: "delivery",
              label: "A domicilio",
              description: "Entrega en tu dirección.",
            },
          ].map((option) => ({
            name: option.name,
            price_type: "flat" as const,
            provider_id: "manual_manual",
            service_zone_id: zoneId!,
            shipping_profile_id: profile.id,
            type: { label: option.label, description: option.description, code: option.code },
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

    // Products «en revisión» (never published) with one offer per variant.
    for (const product of store.products) {
      const productExternalId = externalId(store.slug, product.slug);
      const { data: existing } = await query.graph({
        entity: "product",
        fields: ["id"],
        filters: { external_id: productExternalId },
      });
      if (existing.length) continue;
      const images = await uploadImage(file, imagesDir, store.slug, product);
      // Mercur builds variants from attributes: each option is an inline variant-axis
      // attribute, and the brand a plain text attribute.
      const attributes = [
        ...(product.options ?? []).map((option) => ({
          title: option.title,
          values: option.values,
          is_variant_axis: true,
        })),
        { title: "Marca", value: product.brand },
      ];
      const { result: created } = await createProductsWorkflow(container).run({
        input: {
          created_by: sellerId,
          products: [
            {
              title: product.title,
              subtitle: product.subtitle,
              description: product.description,
              handle: handleOf(store.slug, product.slug),
              external_id: productExternalId,
              status: "proposed",
              material: product.material,
              origin_country: product.origin,
              weight: product.weight,
              ...(images.length
                ? { images: images.map((url) => ({ url })), thumbnail: images[0] }
                : {}),
              category_ids: [categoryIds.get(handleOf(product.category))!].filter(Boolean),
              attributes,
              variants: product.variants.map((variant, index) => {
                const optionValues = product.options?.length ? variant.options : {};
                return {
                  title: product.options?.length
                    ? Object.values(variant.options).join(" / ")
                    : "Default",
                  options: optionValues,
                  manage_inventory: true,
                  variant_rank: index,
                };
              }),
              metadata: { ...marker, brand: product.brand },
              seller_ids: [sellerId],
            } as never,
          ],
        },
      });
      const createdProduct = (
        created as { id: string; variants: { id: string; title: string }[] }[]
      )[0];
      const { data: withVariants } = await query.graph({
        entity: "product",
        fields: ["id", "variants.id", "variants.title"],
        filters: { id: createdProduct.id },
      });
      const variants = withVariants[0].variants as { id: string; title: string }[];
      for (const [index, variant] of product.variants.entries()) {
        const title = product.options?.length
          ? Object.values(variant.options).join(" / ")
          : "Default";
        const variantId = variants.find((row) => row.title === title)?.id ?? variants[index]?.id;
        if (!variantId) continue;
        const sku = `DEMO-${store.slug}-${product.slug}-${index + 1}`.toUpperCase();
        const { result: offers } = await createOffersWorkflow(container).run({
          input: {
            offers: [
              {
                seller_id: sellerId,
                created_by: ownerMemberId,
                sku,
                variant_id: variantId,
                shipping_profile_id: profile.id,
                manage_inventory: true,
                inventory_items: [
                  {
                    sku,
                    title: title === "Default" ? product.title : `${product.title} — ${title}`,
                    stock_levels: [{ location_id: locationId, stocked_quantity: variant.stock }],
                  },
                ],
                prices: [{ amount: variant.price, currency_code: CURRENCY }],
                metadata: marker,
              } as never,
            ],
          },
        });
        await alignNewDemoVariantInventory(container, query, variantId, offers[0].id);
      }
    }
  }
}

async function alignNewDemoVariantInventory(
  container: ExecArgs["container"],
  query: Query,
  variantId: string,
  offerId: string,
) {
  // Each demo variant has exactly one offer. Both checkout paths must use its stock item.
  const [{ data: variants }, { data: offers }] = await Promise.all([
    query.graph({
      entity: "product_variant",
      fields: [
        "inventory_items.inventory_item_id",
        "inventory_items.inventory.sku",
        "inventory_items.inventory.location_levels.id",
      ],
      filters: { id: variantId },
    }),
    query.graph({
      entity: "offer",
      fields: ["variant_id", "inventory_item_link.inventory_item_id"],
      filters: { id: offerId },
    }),
  ]);
  const offer = offers[0];
  const inventoryItemId = offer?.inventory_item_link?.[0]?.inventory_item_id;
  if (
    offer?.variant_id !== variantId ||
    offer.inventory_item_link?.length !== 1 ||
    typeof inventoryItemId !== "string"
  ) {
    throw new Error(`No se pudo identificar el inventario de la oferta demo ${offerId}.`);
  }

  const [placeholder, ...otherLinks] = variants[0]?.inventory_items ?? [];
  if (placeholder?.inventory_item_id === inventoryItemId && !otherLinks.length) return;
  if (
    !variants[0] ||
    otherLinks.length ||
    (placeholder &&
      (!placeholder.inventory?.location_levels ||
        placeholder.inventory.sku ||
        placeholder.inventory.location_levels.length))
  ) {
    throw new Error(`La variante demo ${variantId} ya tiene vínculos de inventario que revisar.`);
  }

  const linkTo = (id: string) => ({
    [Modules.PRODUCT]: { variant_id: variantId },
    [Modules.INVENTORY]: { inventory_item_id: id },
  });
  await batchLinksWorkflow(container).run({
    input: {
      create: [{ ...linkTo(inventoryItemId), data: { required_quantity: 1 } }],
      delete: placeholder ? [linkTo(placeholder.inventory_item_id)] : [],
    },
  });
}

async function uploadImage(
  file: any,
  dir: string | undefined,
  storeSlug: string,
  product: DemoProduct,
): Promise<string[]> {
  if (!dir) return [];
  const source = path.join(dir, `${storeSlug}-${product.slug}.png`);
  if (!existsSync(source)) return [];
  const [uploaded] = await file.createFiles([
    {
      filename: `demo-${storeSlug}-${product.slug}.png`,
      mimeType: "image/png",
      content: readFileSync(source).toString("base64"),
      access: "public",
    },
  ]);
  return uploaded?.url ? [uploaded.url] : [];
}

async function cleanup(
  container: ExecArgs["container"],
  query: Query,
  state: Awaited<ReturnType<typeof demoState>>,
) {
  const auth = container.resolve(Modules.AUTH);
  const inventory = container.resolve(Modules.INVENTORY);
  const commissions = container.resolve<SalesCommissionsService>(
    AGESTYLES_SALES_COMMISSIONS_MODULE,
  );
  const sellerIds = state.sellers.map((seller) => seller.id as string);

  if (sellerIds.length) {
    const { data: offers } = await query.graph({
      entity: "offer",
      fields: ["id", "sku"],
      filters: { seller_id: sellerIds },
    });
    if (offers.length) {
      await deleteOffersWorkflow(container).run({
        input: { ids: offers.map((offer) => offer.id) } as never,
      });
    }
    const skus = offers.map((offer) => offer.sku).filter(Boolean);
    if (skus.length) {
      const items = await inventory.listInventoryItems({ sku: skus });
      if (items.length) await inventory.deleteInventoryItems(items.map((item) => item.id));
    }
    for (const sellerId of sellerIds) {
      const agents = await commissions.listSalesAgents({ seller_id: sellerId });
      if (agents.length)
        await commissions.deleteSalesAgents(agents.map((agent: { id: string }) => agent.id));
      const rules = await commissions.listCommissionRules({ seller_id: sellerId });
      if (rules.length)
        await commissions.deleteCommissionRules(rules.map((rule: { id: string }) => rule.id));
    }
  }
  if (state.products.length) {
    await deleteProductsWorkflow(container).run({
      input: { ids: state.products.map((product) => product.id as string) },
    });
  }

  // Shipping options, delivery areas and stock locations named after the demo stores.
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "metadata",
      "fulfillment_sets.id",
      "fulfillment_sets.service_zones.shipping_options.id",
    ],
  });
  const demoLocations = locations.filter(
    (location) =>
      location.metadata?.[DEMO_MARKER] === true || String(location.name).startsWith("Demo · "),
  );
  const shippingIds = demoLocations.flatMap((location) =>
    (location.fulfillment_sets ?? []).flatMap((set: any) =>
      (set.service_zones ?? []).flatMap((zone: any) =>
        (zone.shipping_options ?? []).map((option: any) => option.id),
      ),
    ),
  );
  if (shippingIds.length)
    await deleteShippingOptionsWorkflow(container).run({ input: { ids: shippingIds } });
  const setIds = demoLocations.flatMap((location) =>
    (location.fulfillment_sets ?? []).map((set: any) => set.id),
  );
  if (setIds.length) await deleteFulfillmentSetsWorkflow(container).run({ input: { ids: setIds } });
  if (demoLocations.length) {
    await deleteStockLocationsWorkflow(container).run({
      input: { ids: demoLocations.map((location) => location.id) },
    });
  }

  // Stores with their members, then the sign-in identities of the demo accounts.
  const memberEmails = new Set<string>();
  if (sellerIds.length) {
    const { data: rows } = await query.graph({
      entity: "seller_member",
      fields: ["member.email"],
      filters: { seller_id: sellerIds },
    });
    for (const row of rows) if (row.member?.email) memberEmails.add(row.member.email);
    await deleteSellersWorkflow(container).run({ input: { ids: sellerIds } });
  }
  // Mercur keeps the member records (and invites) of a deleted store: remove the demo ones.
  const DEMO_EMAIL = /^agestylesdevelop\+demo-[a-z0-9-]+@gmail\.com$/;
  const sellerModule = container.resolve("seller") as any;
  const members = (await sellerModule.listMembers({})) as { id: string; email: string }[];
  const demoMembers = members.filter(
    (member) => DEMO_EMAIL.test(member.email) || memberEmails.has(member.email),
  );
  if (demoMembers.length) await sellerModule.deleteMembers(demoMembers.map((member) => member.id));
  const invites = (await sellerModule.listMemberInvites({})) as { id: string; email: string }[];
  const demoInvites = invites.filter((invite) => DEMO_EMAIL.test(invite.email));
  if (demoInvites.length)
    await sellerModule.deleteMemberInvites(demoInvites.map((invite) => invite.id));
  const identities = await auth.listProviderIdentities({ provider: "emailpass" });
  const demoIdentities = (identities as { entity_id: string; auth_identity_id: string }[]).filter(
    (identity) =>
      memberEmails.has(identity.entity_id) ||
      /^agestylesdevelop\+demo-[a-z0-9-]+@gmail\.com$/.test(identity.entity_id),
  );
  if (demoIdentities.length) {
    await auth.deleteAuthIdentities(demoIdentities.map((identity) => identity.auth_identity_id));
  }

  if (state.customers.length) {
    await deleteCustomersWorkflow(container).run({
      input: { ids: state.customers.map((customer) => customer.id) },
    });
  }
  if (state.categories.length) {
    // Children first: a parent with children cannot be removed.
    const ordered = [...state.categories].sort(
      (a, b) =>
        DEMO_CATEGORIES.findIndex((c) => handleOf(c.slug) === b.handle) -
        DEMO_CATEGORIES.findIndex((c) => handleOf(c.slug) === a.handle),
    );
    for (const category of ordered) {
      await deleteProductCategoriesWorkflow(container).run({ input: [category.id] });
    }
  }
}

/** The user decided the demo stores go public (19 nov 2026): approve, publish and show them. */
async function publish(
  container: ExecArgs["container"],
  query: Query,
  state: Awaited<ReturnType<typeof demoState>>,
) {
  const file = container.resolve(Modules.FILE);
  const photosDir = process.env.AGESTYLES_DEMO_PHOTOS_DIR;

  for (const seller of state.sellers) {
    if (seller.status === "pending_approval") {
      await approveSellerWorkflow(container).run({ input: { seller_id: seller.id } } as never);
    }
  }

  for (const category of state.categories) {
    await updateProductCategoriesWorkflow(container).run({
      input: { selector: { id: category.id }, update: { is_internal: false, is_active: true } },
    });
  }

  // Real photos (free licences) in place of the generated cards.
  if (photosDir) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "external_id", "images.id"],
      filters: { id: state.products.map((product) => product.id) },
    });
    for (const product of products) {
      const key = String(product.external_id).replace(`${DEMO_PREFIX}-`, "");
      const source = ["jpg", "png"]
        .map((ext) => path.join(photosDir, `${key}.${ext}`))
        .find((candidate) => existsSync(candidate));
      if (!source) continue;
      const isPng = source.endsWith(".png");
      const [uploaded] = await file.createFiles([
        {
          filename: `demo-${key}.${isPng ? "png" : "jpg"}`,
          mimeType: isPng ? "image/png" : "image/jpeg",
          content: readFileSync(source).toString("base64"),
          access: "public",
        },
      ]);
      if (!uploaded?.url) continue;
      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: product.id },
          update: { images: [{ url: uploaded.url }], thumbnail: uploaded.url },
        },
      });
    }
  }

  // Approve the pending product requests, as «Aprobar» does in the administration.
  const productIds = state.products.map((product) => product.id as string);
  const { data: changes } = await query.graph({
    entity: "product_change",
    fields: ["id", "status", "product_id"],
    filters: { product_id: productIds },
  });
  const pending = changes
    .filter((change) => change.status === "pending")
    .map((change) => change.id);
  if (pending.length) {
    await confirmProductChangeWorkflow(container).run({
      input: { ids: pending, confirmed_by: "agestyles-demo" },
    } as never);
  }
  // Published and in the store's sales channel, so Tienda and Catálogo list them.
  await updateProductsWorkflow(container).run({
    input: { selector: { id: productIds }, update: { status: "published" } },
  });
  const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] });
  try {
    await linkProductsToSalesChannelWorkflow(container).run({
      input: { id: channels[0].id, add: productIds },
    });
  } catch (error) {
    if (!isAlreadyLinked(error)) throw error;
  }
}
