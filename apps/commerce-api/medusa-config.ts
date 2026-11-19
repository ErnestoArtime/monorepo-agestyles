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
          throw new Error("S3_ENDPOINT must be a valid URL.");
        }
        // Two supported targets: the loopback MinIO of each environment, or the Supabase
        // Storage S3 endpoint of an AgeStyles project (product photos live with the legacy
        // catalog's in the `product-images` bucket, decided 18 nov 2026).
        const loopbackMinio =
          endpoint.protocol === "http:" &&
          endpoint.hostname === "127.0.0.1" &&
          endpoint.port === minioPort &&
          endpoint.pathname === "/";
        const supabaseStorage =
          endpoint.protocol === "https:" &&
          /^[a-z0-9]{20}\.(storage\.)?supabase\.co$/.test(endpoint.hostname) &&
          endpoint.pathname.replace(/\/+$/, "") === "/storage/v1/s3";
        if (
          (!loopbackMinio && !supabaseStorage) ||
          endpoint.username ||
          endpoint.password ||
          endpoint.search ||
          endpoint.hash
        ) {
          throw new Error(
            `S3_ENDPOINT must be http://127.0.0.1:${minioPort} or a Supabase Storage S3 endpoint.`,
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
                  // New AgeStyles uploads stay apart from the legacy catalog's files.
                  prefix: process.env.S3_PREFIX ?? "agestyles/",
                  region: S3_REGION,
                  endpoint: S3_ENDPOINT,
                  additional_client_config: { forcePathStyle: true },
                },
              },
            ],
          },
        };
      })()
    : localMediaModule();

/**
 * Product photos on a server volume (AG-26). MinIO images are no longer published, so the
 * local provider writes to AGESTYLES_MEDIA_DIR and nginx serves it at AGESTYLES_MEDIA_URL.
 * Without both variables the module keeps Medusa's default (no public media).
 */
function localMediaModule() {
  const { AGESTYLES_MEDIA_DIR, AGESTYLES_MEDIA_URL } = process.env;
  if (!AGESTYLES_MEDIA_DIR && !AGESTYLES_MEDIA_URL) return null;
  if (!AGESTYLES_MEDIA_DIR?.startsWith("/") || !AGESTYLES_MEDIA_URL?.startsWith("https://")) {
    throw new Error(
      "AGESTYLES_MEDIA_DIR must be an absolute path and AGESTYLES_MEDIA_URL a public HTTPS URL.",
    );
  }
  return {
    resolve: "@medusajs/medusa/file",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/file-local",
          id: "local",
          options: {
            upload_dir: AGESTYLES_MEDIA_DIR,
            private_upload_dir: `${AGESTYLES_MEDIA_DIR}/private`,
            backend_url: AGESTYLES_MEDIA_URL.replace(/\/+$/, ""),
          },
        },
      ],
    },
  };
}

/**
 * Transactional email (AG-19): SendGrid's official provider, enabled only when both variables
 * are set. Without it the delivery queue marks email deliveries as skipped.
 */
function notificationModule() {
  const { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL } = process.env;
  if (!SENDGRID_API_KEY?.trim() && !SENDGRID_FROM_EMAIL?.trim()) return null;
  if (!SENDGRID_API_KEY?.trim() || !SENDGRID_FROM_EMAIL?.trim()) {
    throw new Error("Email needs both SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.");
  }
  return {
    resolve: "@medusajs/medusa/notification",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/notification-sendgrid",
          id: "sendgrid",
          options: {
            channels: ["email"],
            api_key: SENDGRID_API_KEY.trim(),
            from: SENDGRID_FROM_EMAIL.trim(),
          },
        },
      ],
    },
  };
}

const emailModule = notificationModule();

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
    { resolve: "../../packages/inventory-movements" },
    { resolve: "../../packages/sales-commissions" },
    { resolve: "../../packages/ai-studio" },
    { resolve: "../../packages/notifications" },
    { resolve: "../../packages/category-requests" },
    ...(emailModule ? [emailModule] : []),
    { resolve: "@mercurjs/core/modules/admin-ui", options: { disable: true } },
    { resolve: "@mercurjs/core/modules/vendor-ui", options: { disable: true } },
    { resolve: "@medusajs/medusa/cache-redis", options: { redisUrl: REDIS_URL } },
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: {
        redisUrl: REDIS_URL,
        // No global retries: they would also repeat Medusa/Mercur subscribers with external
        // effects. AgeStyles notification subscribers retry themselves
        // (withNotificationRetries) and lost emissions are recovered from the outbox.
      },
    },
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
