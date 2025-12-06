import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import { GraphqlClient } from "@shopify/shopify-api";
import shopify from "../shopify.server";
import { supabaseAdmin } from "@/app/lib/supabase/server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const signature = request.headers.get("X-Lomi-Signature");
  const event = request.headers.get("X-Lomi-Event");

  if (!signature || event !== "PAYMENT_SUCCEEDED") {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    // 1. Identification: Identify the Shopify Shop from metadata
    const shop = payload?.data?.metadata?.shopify_shop;

    if (!shop) {
      console.error("Missing shopify_shop in metadata");
      return json({ error: "Missing metadata" }, { status: 400 });
    }

    // 2. Security: Fetch stored Webhook Secret for this shop metadata to verify signature
    // Using public.shopify_stores
    const { data: storeData, error: storeError } = await supabaseAdmin
      .from("shopify_stores")
      .select("metadata")
      .eq("shop_domain", shop)
      .single();

    // Extract secret from metadata (safely handling potential nulls/types)
    // @ts-ignore
    const apiSecret = storeData?.metadata?.webhook_secret;

    if (storeError || !apiSecret) {
      console.error(`No API secret found for shop ${shop} in metadata`);
      // Return 200 to acknowledge receipt but log error (prevent loop)
      return json({ message: "Configuration error" }, { status: 200 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", apiSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("Invalid signature for webhook");
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Logic: Create Order in Shopify
    // We need an offline session to assume the identity of the shop
    // Manual offline session ID construction (standard pattern)
    // Note: shopify.api.session.getOfflineId() is unavailable on the app object type, so we use manual construction.
    const offlineSessionId = `offline_${shop}`;
    const session = await shopify.sessionStorage.loadSession(offlineSessionId);

    if (!session) {
      console.error(`No offline session found for shop ${shop}`);
      return json({ message: "Session not found" }, { status: 200 });
    }

    // Use imported GraphqlClient directly to avoid type issues with shopifyApp object
    const client = new GraphqlClient({ session });

    // Create a Draft Order first (best practice for programmatic orders)
    // We map the transaction amount.
    // Lomi amount is likely in standard units (e.g. 5000 for 5000 XOF).
    // Shopify DraftOrderCreate expects amount as string.
    const amount = payload.data.amount;
    // const currency = payload.data.currency_code; // Unused
    const customerEmail = payload.data.customer?.email;

    const draftOrderData = {
      lineItems: [
        {
          title: "Lomi Payment",
          originalUnitPrice: amount.toString(),
          quantity: 1,
        },
      ],
      tags: ["lomi-payment", "paid"],
      financialStatus: "PAID",
      email: customerEmail,
    };

    // Use GraphQL to create Draft Order
    const createDraftOrderMutation = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.query({
      data: {
        query: createDraftOrderMutation,
        variables: {
          input: draftOrderData,
        },
      },
    });

    // @ts-ignore
    const draftOrderResult = response.body.data?.draftOrderCreate;

    if (draftOrderResult?.userErrors?.length > 0) {
      console.error(
        "Shopify Draft Order Creation Failed:",
        draftOrderResult.userErrors,
      );
      return json({ error: "Order creation failed" }, { status: 500 });
    }

    const draftOrderId = draftOrderResult?.draftOrder?.id;

    // Complete the Draft Order to make it a real Order
    const completeDraftOrderMutation = `
      mutation draftOrderComplete($id: ID!) {
        draftOrderComplete(id: $id) {
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

    await client.query({
      data: {
        query: completeDraftOrderMutation,
        variables: {
          id: draftOrderId,
        },
      },
    });

    return json({ success: true, order_id: draftOrderId });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}
