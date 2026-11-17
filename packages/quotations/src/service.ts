import { MedusaService } from "@medusajs/framework/utils"
import OrderQuote from "./models/quote"

class OrderQuotesService extends MedusaService({ OrderQuote }) {}
export default OrderQuotesService
