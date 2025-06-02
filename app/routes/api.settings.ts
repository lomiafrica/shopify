import { data } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "@/app/utils/supabase/server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  try {
    const { data: settings, error } = await supabaseAdmin.rpc("get_shopify_shop_settings", {
      p_shop: session.shop
    });

    if (error) throw error;

    // RPC returns an array, get the first item or return empty object
    return data(settings && settings.length > 0 ? settings[0] : {});
  } catch (error) {
    console.error("Error loading settings:", error);
    return data({});
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const requestData = await request.json();

    // Use RPC function to upsert shop settings
    const { error: upsertError } = await supabaseAdmin.rpc("upsert_shopify_shop_settings", {
      p_shop: session.shop,
      p_api_key: requestData.api_key,
      p_api_secret: requestData.api_secret,
      p_merchant_id: requestData.merchant_id,
      p_webhook_url: requestData.webhook_url
    });

    if (upsertError) throw upsertError;

    // Register the checkout extension
    const response = await fetch(
      "https://api.lomi.africa/v1/shopify/register-extension",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${requestData.api_key}`,
        },
        body: JSON.stringify({
          shop: session.shop,
          merchant_id: requestData.merchant_id,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to register extension");
    }

    return data({ success: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    return data(
      {
        error:
          error instanceof Error ? error.message : "Failed to save settings",
      },
      { status: 500 },
    );
  }
}
