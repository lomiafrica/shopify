import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { SupabaseSessionStorage } from "@/app/lib/utils/session-storage";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times.
  // If this webhook already ran, the session might have been deleted previously by ShopifyAppRemix's default handling or a prior run.
  // This code ensures all sessions for the shop are cleared from our Supabase table.
  if (shop) {
    const sessionStorage = new SupabaseSessionStorage();
    const sessions = await sessionStorage.findSessionsByShop(shop);

    if (sessions.length > 0) {
      const sessionIds = sessions.map((s) => s.id);
      await sessionStorage.deleteSessions(sessionIds);
      console.log(
        `[AppUninstalled] Deleted ${sessionIds.length} sessions for shop ${shop}`,
      );
    }
  } else {
    console.warn(
      "Shopify shop domain not found in webhook payload for app/uninstalled.",
    );
  }

  return new Response(null, { status: 200 });
};
