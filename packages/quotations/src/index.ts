import { Module } from "@medusajs/framework/utils"
import OrderQuotesService from "./service"

export const AGESTYLES_ORDER_QUOTES_MODULE = "agestylesOrderQuotes"
export default Module(AGESTYLES_ORDER_QUOTES_MODULE, { service: OrderQuotesService })
