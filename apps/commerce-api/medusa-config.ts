import { loadEnv } from "@medusajs/framework/utils";
import { withMercur } from "@mercurjs/core";
import { MercurModules } from "@mercurjs/types";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const { DATABASE_URL, REDIS_URL, JWT_SECRET, COOKIE_SECRET } = process.env;
const environment = process.env.AGESTYLES_COMMERCE_ENV || "lab";
const production = environment === "production";
const databasePattern = production
  ? /^postgres(?:ql)?:\/\/agestyles_production:[a-f0-9]+@127\.0\.0\.1:15473\/agestyles_commerce$/
  : /^postgres(?:ql)?:\/\/agestyles_lab:[a-f0-9]+@127\.0\.0\.1:15472\/agestyles_mercur_lab$/;
const redisUrl = production ? "redis://127.0.0.1:16393" : "redis://127.0.0.1:16392";
const fileStorageProvider = process.env.AGESTYLES_FILE_STORAGE_PROVIDER || "local";
const minioPort = production ? "19086" : "19083";
const localOrigins = "http://localhost:18081,http://127.0.0.1:18081";
const buyerOrigins = `${localOrigins},https://tienda.eav-labs.com`;

if (
  (environment !== "lab" && !production) ||
  !DATABASE_URL?.match(databasePattern) ||
  REDIS_URL !== redisUrl ||
  !JWT_SECRET ||
  !COOKIE_SECRET
) {
  throw new Error(
    "Configure the database, Redis and secrets for the selected AgeStyles environment.",
  );
}

if (fileStorageProvider !== "local" && fileStorageProvider !== "s3") {
  throw new Error("AGESTYLES_FILE_STORAGE_PROVIDER must be either local or s3.");
}

const fileModule =
  fileStorageProvider === "s3"
    ? (() => {
        const {
          S3_FILE_URL,
          S3_ACCESS_KEY_ID,
          S3_SECRET_ACCESS_KEY,
          S3_BUCKET,
          S3_REGION,
          S3_ENDPOINT,
        } = process.env;
        if (
          !S3_FILE_URL ||
          !S3_ACCESS_KEY_ID ||
          !S3_SECRET_ACCESS_KEY ||
          !S3_BUCKET ||
          !S3_REGION ||
          !S3_ENDPOINT
        ) {
          throw new Error(
            "S3 file storage requires S3_FILE_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION and S3_ENDPOINT.",
          );
        }
        let endpoint: URL;
        try {
          endpoint = new URL(S3_ENDPOINT);
        } catch {
          throw new Error("S3_ENDPOINT must be a valid loopback MinIO URL.");
        }
        if (
          endpoint.protocol !== "http:" ||
          endpoint.hostname !== "127.0.0.1" ||
          endpoint.port !== minioPort ||
          endpoint.username ||
          endpoint.password ||
          endpoint.pathname !== "/" ||
          endpoint.search ||
          endpoint.hash
        ) {
          throw new Error(
            `S3_ENDPOINT must be http://127.0.0.1:${minioPort} for this environment.`,
          );
        }
        if (!S3_FILE_URL.startsWith("https://")) {
          throw new Error(
            "S3_FILE_URL must be a public HTTPS URL before buyer-facing media is enabled.",
          );
        }
        return {
          resolve: "@medusajs/medusa/file",
          options: {
            providers: [
              {
                resolve: "@medusajs/medusa/file-s3",
                id: "s3",
                options: {
                  file_url: S3_FILE_URL,
                  access_key_id: S3_ACCESS_KEY_ID,
                  secret_access_key: S3_SECRET_ACCESS_KEY,
                  bucket: S3_BUCKET,
                  region: S3_REGION,
                  endpoint: S3_ENDPOINT,
                  additional_client_config: { forcePathStyle: true },
                },
              },
            ],
          },
        };
      })()
    : null;

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
    ...(fileModule ? [fileModule] : []),
    { resolve: "./src/modules/seller-permissions", dependencies: [MercurModules.SELLER] },
    { resolve: "../../packages/quotations" },
    { resolve: "../../packages/catalog-pim" },
    { resolve: "../../packages/manual-payments" },
    { resolve: "@mercurjs/core/modules/admin-ui", options: { disable: true } },
    { resolve: "@mercurjs/core/modules/vendor-ui", options: { disable: true } },
    { resolve: "@medusajs/medusa/cache-redis", options: { redisUrl: REDIS_URL } },
    { resolve: "@medusajs/medusa/event-bus-redis", options: { redisUrl: REDIS_URL } },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: { redis: { redisUrl: REDIS_URL } },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "locking-redis",
            is_default: true,
            options: { redisUrl: REDIS_URL },
          },
        ],
      },
    },
  ],
});
