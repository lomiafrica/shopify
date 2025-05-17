import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "@/app/utils/supabase/server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times.
  // If this webhook already ran, the session might have been deleted previously by ShopifyAppRemix's default handling or a prior run.
  // This code ensures all sessions for the shop are cleared from our Supabase table.
  if (shop) {
    const { error } = await supabaseAdmin
      .from('shopify_sessions') // Table name from SupabaseSessionStorage
      .delete()
      .eq('shop', shop);

    if (error) {
      console.error(`Failed to delete sessions from Supabase for shop ${shop}:`, error.message);
      // Consider returning a 500 error to Shopify to signal an issue,
      // though Shopify might retry the webhook. For uninstalls, it might be less critical.
      // return new Response("Failed to delete sessions", { status: 500 });
    } else {
      console.log(`Successfully deleted sessions from Supabase for shop ${shop}`);
    }
  } else {
    console.warn("Shopify shop domain not found in webhook payload for app/uninstalled.");
  }

  return new Response(null, { status: 200 });
};
