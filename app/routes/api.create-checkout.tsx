import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "@/app/lib/supabase/server";

export async function action({ request }: ActionFunctionArgs) {
  const { sessionToken, cors } = await authenticate.public.checkout(request);

  if (request.method !== "POST") {
    return cors(json({ error: "Method not allowed" }, { status: 405 }));
  }

  try {
    const requestData = await request.json();
    const { cart, lineItems, currencyCode } = requestData;

    if (!cart && !lineItems) {
      return cors(json({ error: "Missing cart data" }, { status: 400 }));
    }

    // Extract shop from session token dest
    // dest is usually "https://shop-name.myshopify.com"
    const shopUrl = new URL(sessionToken.dest);
    const shop = shopUrl.hostname;

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
        "Failed to retrieve settings or API key missing",
        settingsError,
      );
      return cors(
        json(
          { error: "Shop settings not found or API key missing" },
          { status: 404 },
        ),
      );
    }

    const apiKey = settings[0].api_key;
    const session = { shop }; // For payload construction below

    // 2. Construct the payload for Lomi API
    // Mapping Shopify Line Items to Lomi Line Items (simplified for now)
    // We are trusting the extension to send us valid line items or cart structure

    // The payload needs to match CreateCheckoutSessionDto
    const payload = {
      description: "Shopify Checkout",
      currency_code: currencyCode || "XOF", // Default or from request
      success_url: requestData.successUrl || `https://${session.shop}/checkout`, // Fallback
      cancel_url: requestData.cancelUrl || `https://${session.shop}/cart`,
      amount: requestData.totalAmount, // If trusted, or calculate from lines
      // We might need to map line items if Lomi API supports them directly in session creation
      // Based on DTO, it supports product_id/quantity BUT also we likely want a generic amount for now if products aren't synced.
      // Ideally, products should be synced, but for "Express Pay", just passing the total amount is a good start if allowed.
      // DTO shows `amount` is optional if `product_id` provided, but can be passed directly.
      metadata: {
        shopify_shop: session.shop,
        shopify_cart_id: cart?.id,
      },
    };

    // 3. Call Lomi API
    const lomiResponse = await fetch(
      "https://api.lomi.africa/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey, // Using x-api-key as per typical pattern, confirming from standard practice or DTO
        },
        body: JSON.stringify(payload),
      },
    );

    if (!lomiResponse.ok) {
      const errorText = await lomiResponse.text();
      console.error("Lomi API Error:", lomiResponse.status, errorText);
      return cors(
        json(
          {
            error: "Failed to create checkout session with Lomi",
            details: errorText,
          },
          { status: lomiResponse.status },
        ),
      );
    }

    const lomiData = await lomiResponse.json();

    // 4. Return the checkout URL
    // Depending on ResponseDto, likely returning { checkout_url: ... } or { url: ... } or { id: ... }
    return cors(json(lomiData));
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return cors(
      json(
        {
          error:
            error instanceof Error ? error.message : "Internal Server Error",
        },
        { status: 500 },
      ),
    );
  }
}
