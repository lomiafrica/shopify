import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { DeliveryMethod, ApiVersion } from "@shopify/shopify-api";
import { SupabaseSessionStorage } from "./utils/session-storage";

if (!process.env.SHOPIFY_CLIENT_ID) {
  throw new Error("Missing SHOPIFY_CLIENT_ID environment variable");
}

if (!process.env.SHOPIFY_CLIENT_SECRET) {
  throw new Error("Missing SHOPIFY_CLIENT_SECRET environment variable");
}

if (!process.env.SHOPIFY_APP_URL) {
  throw new Error("Missing SHOPIFY_APP_URL environment variable");
}

if (!process.env.SHOPIFY_SCOPES) {
  throw new Error("Missing SHOPIFY_SCOPES environment variable");
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_CLIENT_ID,
  apiSecretKey: process.env.SHOPIFY_CLIENT_SECRET,
  appUrl: process.env.SHOPIFY_APP_URL,
  scopes: (process.env.SHOPIFY_SCOPES || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope),
  authPathPrefix: "/auth",
  sessionStorage: new SupabaseSessionStorage(),
  apiVersion: ApiVersion.January23,
  isEmbeddedApp: true,
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      shopify.registerWebhooks({ session });
    },
  },
  future: {
    v3_webhookAdminContext: true,
    v3_authenticatePublic: true,
  },
});

export default shopify;
export const authenticate = shopify.authenticate;
