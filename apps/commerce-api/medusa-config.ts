import { loadEnv } from "@medusajs/framework/utils"
import { withMercur } from "@mercurjs/core"
import { MercurModules } from "@mercurjs/types"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const { DATABASE_URL, REDIS_URL, JWT_SECRET, COOKIE_SECRET } = process.env
const localOrigins = "http://localhost:18081,http://127.0.0.1:18081"
const buyerOrigins = `${localOrigins},https://tienda.eav-labs.com`

if (
  !DATABASE_URL?.match(/^postgres(?:ql)?:\/\/agestyles_lab:[a-f0-9]+@127\.0\.0\.1:15472\/agestyles_mercur_lab$/) ||
  REDIS_URL !== "redis://127.0.0.1:16392" ||
  !JWT_SECRET || !COOKIE_SECRET
) {
  throw new Error("Configure the isolated AgeStyles lab before starting Mercur.")
}

module.exports = withMercur({
  // The isolated lab uses Mercur's graph query path until its index engine is
  // proven to refresh newly approved sellers and offers consistently.
  featureFlags: { index_engine: false },
  admin: { disable: true },
  projectConfig: {
    databaseUrl: DATABASE_URL,
    redisUrl: REDIS_URL,
    http: {
      storeCors: buyerOrigins,
      adminCors: localOrigins,
      vendorCors: localOrigins,
      authCors: buyerOrigins,
      jwtSecret: JWT_SECRET,
      cookieSecret: COOKIE_SECRET,
    },
  },
  modules: [
    { resolve: "./src/modules/seller-permissions", dependencies: [MercurModules.SELLER] },
    { resolve: "../../packages/quotations" },
    { resolve: "../../packages/catalog-pim" },
    { resolve: "../../packages/manual-payments" },
    { resolve: "@mercurjs/core/modules/admin-ui", options: { disable: true } },
    { resolve: "@mercurjs/core/modules/vendor-ui", options: { disable: true } },
    { resolve: "@medusajs/medusa/cache-redis", options: { redisUrl: REDIS_URL } },
    { resolve: "@medusajs/medusa/event-bus-redis", options: { redisUrl: REDIS_URL } },
    { resolve: "@medusajs/medusa/workflow-engine-redis", options: { redis: { redisUrl: REDIS_URL } } },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [{
          resolve: "@medusajs/medusa/locking-redis",
          id: "locking-redis",
          is_default: true,
          options: { redisUrl: REDIS_URL },
        }],
      },
    },
  ],
})
