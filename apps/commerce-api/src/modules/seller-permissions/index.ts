import { Module } from "@medusajs/framework/utils"
import { PERMISSIONS_MODULE } from "@mercurjs/types"
import SellerPermissionsService from "./service"

export default Module(PERMISSIONS_MODULE, { service: SellerPermissionsService })
