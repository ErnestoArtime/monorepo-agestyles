import { Module } from "@medusajs/framework/utils"
import CatalogPimService from "./service"

export { CatalogPimService }
export type {
  CreateCatalogFamilyInput,
  UpdateCatalogFamilyInput,
} from "./service"

export const AGESTYLES_CATALOG_PIM_MODULE = "agestylesCatalogPim"

export default Module(AGESTYLES_CATALOG_PIM_MODULE, {
  service: CatalogPimService,
})
