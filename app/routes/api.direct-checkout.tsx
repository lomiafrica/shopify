import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { supabaseAdmin } from "@/app/lib/supabase/server";

/**
 * CORS headers for direct API access from checkout extensions
 * This endpoint bypasses the app proxy to avoid password protection issues
 */
function corsHeaders(origin?: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Shopify-Access-Token, X-Shop-Domain",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * Helper to create a CORS-enabled JSON response
 */
function corsJson(data: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

/**
 * Loader handles OPTIONS preflight and GET health check
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const origin = request.headers.get("Origin") || undefined;

  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // GET health check
  return corsJson({ status: "ok", endpoint: "direct-checkout" }, 200, origin);
}

/**
 * Action handles POST to create a checkout session
 * This is called directly from the checkout extension
 */
export async function action({ request }: ActionFunctionArgs) {
  const origin = request.headers.get("Origin") || undefined;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (request.method !== "POST") {
    return corsJson({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const requestData = await request.json();
    const { lineItems, totalAmount, currencyCode, shopDomain } = requestData;

    // Validate required fields
    if (!shopDomain) {
      return corsJson({ error: "Missing shopDomain" }, 400, origin);
    }

    if (!totalAmount) {
      return corsJson({ error: "Missing totalAmount" }, 400, origin);
    }

    // Clean shop domain (remove protocol if present)
    const shop = shopDomain.replace(/^https?:\/\//, "");

    console.log("[direct-checkout] Processing checkout for shop:", shop);

    // 1. Retrieve the Lomi API Key for this shop
    const { data: settings, error: settingsError } = await supabaseAdmin.rpc(
      "get_shopify_shop_settings",
      {
        p_shop: shop,
      },
    );

    if (
      settingsError ||
      !settings ||
      settings.length === 0 ||
      !settings[0].api_key
    ) {
      console.error(
        "[direct-checkout] Failed to retrieve settings or API key missing",
        settingsError,
      );
      return corsJson(
        { error: "Shop settings not found or API key missing" },
        404,
        origin,
      );
    }

    const apiKey = settings[0].api_key;
    console.log("[direct-checkout] Found API key for shop:", shop);

    // 2. Construct the payload for Lomi API
    const payload = {
      description: "Shopify Checkout",
      currency_code: currencyCode || "XOF",
      success_url: `https://${shop}/checkout/thank-you`,
      cancel_url: `https://${shop}/cart`,
      amount: totalAmount,
      integration_source: "shopify",
      metadata: {
        shopify_shop: shop,
        line_items_count: lineItems?.length || 0,
      },
    };

    console.log("[direct-checkout] Calling lomi API with payload:", payload);

    // 3. Call Lomi API
    const lomiResponse = await fetch(
      "https://api.lomi.africa/checkout-sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!lomiResponse.ok) {
      const errorText = await lomiResponse.text();
      console.error(
        "[direct-checkout] Lomi API Error:",
        lomiResponse.status,
        errorText,
      );
      return corsJson(
        {
          error: "Failed to create checkout session with Lomi",
          details: errorText,
        },
        lomiResponse.status,
        origin,
      );
    }

    const lomiData = await lomiResponse.json();
    console.log("[direct-checkout] Lomi checkout created:", lomiData);

    // 4. Return the checkout URL
    return corsJson(lomiData, 200, origin);
  } catch (error) {
    console.error("[direct-checkout] Error creating checkout session:", error);
    return corsJson(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500,
      origin,
    );
  }
}
