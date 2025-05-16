import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { supabase } from "@/utils/supabase/client";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  try {
    const { data: settings, error } = await supabase
      .from("shopify_shop_settings")
      .select("*")
      .eq("shop", session.shop)
      .single();

    if (error) throw error;
    return json(settings || {});
  } catch (error) {
    console.error("Error loading settings:", error);
    return json({});
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const data = await request.json();
    const settings = {
      shop: session.shop,
      api_key: data.api_key,
      api_secret: data.api_secret,
      merchant_id: data.merchant_id,
      webhook_url: data.webhook_url,
      updated_at: new Date().toISOString(),
    };

    // Save settings to Supabase
    const { error: upsertError } = await supabase
      .from("shopify_shop_settings")
      .upsert(settings, {
        onConflict: "shop",
      });

    if (upsertError) throw upsertError;

    // Register the checkout extension
    const response = await fetch(
      "https://api.lomi.africa/v1/shopify/register-extension",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.api_key}`,
        },
        body: JSON.stringify({
          shop: session.shop,
          merchant_id: data.merchant_id,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to register extension");
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    return json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save settings",
      },
      { status: 500 },
    );
  }
}
