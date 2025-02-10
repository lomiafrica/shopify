import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { DeliveryMethod, ApiVersion } from "@shopify/shopify-api";
import { SupabaseSessionStorage } from "./utils/session-storage";

if (!process.env.SHOPIFY_API_KEY) {
  throw new Error("Missing SHOPIFY_API_KEY environment variable");
}

if (!process.env.SHOPIFY_API_SECRET) {
  throw new Error("Missing SHOPIFY_API_SECRET environment variable");
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  appUrl: process.env.SHOPIFY_APP_URL || "",
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
