import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import { GraphqlClient } from "@shopify/shopify-api";
import shopify from "../shopify.server";
import { supabaseAdmin } from "@/app/lib/supabase/server";

interface ShopifyLineItem {
  title: string;
  variant_id: string | null;
  quantity: number;
  price: string;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const signature = request.headers.get("X-Lomi-Signature");
  const event = request.headers.get("X-Lomi-Event");

  console.log("[webhook] Received lomi. webhook:", event);

  if (!signature || event !== "PAYMENT_SUCCEEDED") {
    console.log("[webhook] Invalid request - missing signature or wrong event");
    return json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    console.log("[webhook] Payload:", JSON.stringify(payload, null, 2));

    // 1. Extract shop from metadata
    const shop = payload?.data?.metadata?.shopify_shop;

    if (!shop) {
      console.error("[webhook] Missing shopify_shop in metadata");
      return json({ error: "Missing metadata" }, { status: 400 });
    }

    console.log("[webhook] Processing for shop:", shop);

    // 2. Fetch webhook secret using the correct RPC
    const { data: settings, error: settingsError } = await supabaseAdmin.rpc(
      "get_shopify_shop_settings",
      { p_shop: shop },
    );

    if (settingsError || !settings || settings.length === 0) {
      console.error("[webhook] Failed to get shop settings:", settingsError);
      return json({ message: "Shop not configured" }, { status: 200 });
    }

    const webhookSecret = settings[0].webhook_secret;

    if (!webhookSecret) {
      console.error("[webhook] No webhook secret configured for shop:", shop);
      // Return 200 to prevent retries but log the configuration error
      return json({ message: "Webhook secret not configured" }, { status: 200 });
    }

    // 3. Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("[webhook] Invalid signature");
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    console.log("[webhook] Signature verified successfully");

    // 4. Get Shopify session for API calls
    const offlineSessionId = `offline_${shop}`;
    const session = await shopify.sessionStorage.loadSession(offlineSessionId);

    if (!session) {
      console.error("[webhook] No offline session found for shop:", shop);
      return json({ message: "Session not found" }, { status: 200 });
    }

    const client = new GraphqlClient({ session });

    // 5. Parse line items from metadata
    let lineItems: ShopifyLineItem[] = [];
    try {
      const rawLineItems = payload?.data?.metadata?.shopify_line_items;
      if (rawLineItems) {
        lineItems = JSON.parse(rawLineItems);
      }
    } catch {
      console.log("[webhook] Could not parse line items, using fallback");
    }

    // 6. Build draft order line items
    const amount = payload.data.amount;
    const customerEmail = payload.data.customer?.email;
    const customerName = payload.data.customer?.name;

    let draftOrderLineItems;

    if (lineItems.length > 0) {
      // Use actual line items from Shopify checkout
      draftOrderLineItems = lineItems.map((item) => {
        if (item.variant_id) {
          // If we have a variant ID, use it
          return {
            variantId: item.variant_id,
            quantity: item.quantity,
          };
        } else {
          // Custom line item (no variant)
          return {
            title: item.title,
            originalUnitPrice: item.price,
            quantity: item.quantity,
          };
        }
      });
    } else {
      // Fallback: create a single line item
      draftOrderLineItems = [
        {
          title: "lomi. Payment",
          originalUnitPrice: amount.toString(),
          quantity: 1,
        },
      ];
    }

    console.log("[webhook] Creating draft order with", draftOrderLineItems.length, "line items");

    // 7. Create Draft Order
    const createDraftOrderMutation = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const draftOrderInput: Record<string, unknown> = {
      lineItems: draftOrderLineItems,
      tags: ["lomi-payment", "paid"],
      note: "Payment processed via lomi.",
    };

    if (customerEmail) {
      draftOrderInput.email = customerEmail;
    }

    if (customerName) {
      draftOrderInput.shippingAddress = {
        firstName: customerName.split(" ")[0] || customerName,
        lastName: customerName.split(" ").slice(1).join(" ") || "",
      };
    }

    const response = await client.query({
      data: {
        query: createDraftOrderMutation,
        variables: { input: draftOrderInput },
      },
    });

    // @ts-expect-error - response.body typing issue
    const draftOrderResult = response.body.data?.draftOrderCreate;

    if (draftOrderResult?.userErrors?.length > 0) {
      console.error("[webhook] Draft order creation failed:", draftOrderResult.userErrors);
      return json({ error: "Order creation failed", details: draftOrderResult.userErrors }, { status: 500 });
    }

    const draftOrderId = draftOrderResult?.draftOrder?.id;
    const draftOrderName = draftOrderResult?.draftOrder?.name;

    console.log("[webhook] Draft order created:", draftOrderName);

    // 8. Complete the Draft Order to make it a real Order
    const completeDraftOrderMutation = `
      mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
        draftOrderComplete(id: $id, paymentPending: $paymentPending) {
          draftOrder {
            order {
              id
              name
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const completeResponse = await client.query({
      data: {
        query: completeDraftOrderMutation,
        variables: {
          id: draftOrderId,
          paymentPending: false, // Mark as paid
        },
      },
    });

    // @ts-expect-error - response.body typing issue
    const completeResult = completeResponse.body.data?.draftOrderComplete;

    if (completeResult?.userErrors?.length > 0) {
      console.error("[webhook] Draft order completion failed:", completeResult.userErrors);
      return json({ error: "Order completion failed" }, { status: 500 });
    }

    const orderName = completeResult?.draftOrder?.order?.name;
    const orderId = completeResult?.draftOrder?.order?.id;

    console.log("[webhook] Order created successfully:", orderName);

    return json({
      success: true,
      order_id: orderId,
      order_name: orderName,
    });
  } catch (error) {
    console.error("[webhook] Processing error:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}
