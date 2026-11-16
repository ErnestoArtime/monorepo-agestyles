import type Medusa from "@medusajs/js-sdk"

export type StoreClient = Pick<Medusa["client"], "fetch">
