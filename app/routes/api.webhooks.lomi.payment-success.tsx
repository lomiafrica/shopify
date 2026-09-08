import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import {
  isJsonObject,
  isNumber,
  isString,
  validateJsonValue,
  type JsonObject,
} from "@lomi./shared";
import type { Session } from "@shopify/shopify-api";
import { GraphqlClient } from "@shopify/shopify-api";
import shopify from "../shopify.server";
import { supabaseAdmin } from "@/app/lib/supabase/server";
import { completeDraftOrder } from "@/app/lib/shopify/draft-order.server";

interface ShopifyLineItem {
  title: string;
  variant_id: string | null;
  quantity: number;
  price: string;
}

function getPaymentAmount(data: JsonObject): number | null {
  if (isNumber(data.amount)) {
    return data.amount;
  }
  if (isNumber(data.gross_amount)) {
    return data.gross_amount;
  }
  if (isString(data.amount)) {
    const parsed = parseFloat(data.amount);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (isString(data.gross_amount)) {
    const parsed = parseFloat(data.gross_amount);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getTransactionId(data: JsonObject): string | null {
  const id = data.transaction_id ?? data.id;
  return isString(id) ? id : null;
}

async function loadOfflineSession(shop: string): Promise<Session | null> {
  const offlineSessionId = `offline_${shop}`;
  return (await shopify.sessionStorage.loadSession(offlineSessionId)) ?? null;
}

async function completeExistingDraftOrder(
  session: Session,
  draftOrderId: string,
  transactionId: string | null,
): Promise<{ orderId: string | null; orderName: string | null }> {
  const { orderId, orderName } = await completeDraftOrder(session, draftOrderId);

  await supabaseAdmin.rpc("complete_shopify_pending_payment", {
    p_draft_order_id: draftOrderId,
    p_lomi_transaction_id: transactionId,
  });

  return { orderId, orderName };
}

/** Legacy path: create draft order from line items after payment (pre cart-bypass rollout). */
async function createLegacyDraftOrder(
  session: Session,
  payload: {
    data: {
      amount?: unknown;
      gross_amount?: unknown;
      customer?: { email?: string; name?: string };
      metadata?: JsonObject;
    };
  },
) {
  const client = new GraphqlClient({ session });
  // SAFETY: Boundary value matches the asserted domain type at this call site.
  const amount = getPaymentAmount(payload.data as JsonObject);
  const customerEmail = payload.data.customer?.email;
  const customerName = payload.data.customer?.name;

  let lineItems: ShopifyLineItem[] = [];
  try {
    const rawLineItems = payload?.data?.metadata?.shopify_line_items;
    if (isString(rawLineItems)) {
      lineItems = JSON.parse(rawLineItems);
    }
  } catch {
    console.log("[webhook] Could not parse legacy line items");
  }

  let draftOrderLineItems;
  if (lineItems.length > 0) {
    draftOrderLineItems = lineItems.map((item) => {
      if (item.variant_id) {
        const variantId = item.variant_id.startsWith("gid://")
          ? item.variant_id
          : `gid://shopify/ProductVariant/${item.variant_id}`;
        return { variantId, quantity: item.quantity };
      }
      return {
        title: item.title,
        originalUnitPrice: item.price,
        quantity: item.quantity,
      };
    });
  } else {
    draftOrderLineItems = [
      {
        title: "lomi. Payment",
        originalUnitPrice: amount?.toString() ?? "0",
        quantity: 1,
      },
    ];
  }

  const draftOrderInput = validateJsonValue({
    lineItems: draftOrderLineItems,
    tags: ["lomi-payment", "paid"],
    note: "Payment processed via lomi. (legacy flow)",
  });
  if (!isJsonObject(draftOrderInput)) {
    throw new TypeError("Draft order input must be a JSON object");
  }

  if (customerEmail) {
    draftOrderInput.email = customerEmail;
  }
  if (customerName) {
    draftOrderInput.shippingAddress = {
      firstName: customerName.split(" ")[0] || customerName,
      lastName: customerName.split(" ").slice(1).join(" ") || "",
    };
  }

  const createResponse = await client.query({
    data: {
      query: `
        mutation draftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder { id name }
            userErrors { field message }
          }
        }
      `,
      variables: { input: draftOrderInput },
    },
  });

  // @ts-expect-error - response.body typing
  const createResult = createResponse.body?.data?.draftOrderCreate;
  if (createResult?.userErrors?.length > 0) {
    throw new Error(
      createResult.userErrors.map((e: { message: string }) => e.message).join("; "),
    );
  }

  const draftOrderId = createResult?.draftOrder?.id;
  if (!draftOrderId) {
    throw new Error("Legacy draft order creation failed");
  }

  return completeDraftOrder(session, draftOrderId);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const signature = request.headers.get("X-Lomi-Signature");
  const event = request.headers.get("X-Lomi-Event");

  console.log("[webhook] Received lomi. webhook:", event);

  if (!signature || event !== "PAYMENT_SUCCEEDED") {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    const shop = payload?.data?.metadata?.shopify_shop;
    if (!shop || !isString(shop)) {
      console.error("[webhook] Missing shopify_shop in metadata");
      return json({ error: "Missing metadata" }, { status: 400 });
    }

    const { data: settings, error: settingsError } = await supabaseAdmin.rpc(
      "get_shopify_shop_settings",
      { p_shop: shop },
    );

    if (settingsError || !settings?.length) {
      return json({ message: "Shop not configured" }, { status: 200 });
    }

    const webhookSecret = settings[0].webhook_secret;
    if (!webhookSecret) {
      return json({ message: "Webhook secret not configured" }, { status: 200 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const sigBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    const session = await loadOfflineSession(shop);
    if (!session) {
      return json({ message: "Session not found" }, { status: 200 });
    }

    const metadata = payload?.data?.metadata ?? {};
    const draftOrderId =
      isString(metadata.shopify_draft_order_id)
        ? metadata.shopify_draft_order_id
        : null;
    const transactionId = getTransactionId(payload.data ?? {});

    if (draftOrderId) {
      const { data: pending } = await supabaseAdmin.rpc(
        "get_shopify_pending_payment",
        { p_draft_order_id: draftOrderId },
      );

      if (pending?.length && pending[0].status === "completed") {
        console.log("[webhook] Draft order already completed:", draftOrderId);
        return json({ success: true, message: "Already completed" });
      }

      const { orderId, orderName } = await completeExistingDraftOrder(
        session,
        draftOrderId,
        transactionId,
      );

      console.log("[webhook] Completed existing draft order:", orderName);

      return json({
        success: true,
        order_id: orderId,
        order_name: orderName,
        draft_order_id: draftOrderId,
      });
    }

    console.log("[webhook] Legacy flow — no draft order id in metadata");
    const legacyResult = await createLegacyDraftOrder(session, payload);

    return json({
      success: true,
      order_id: legacyResult.orderId,
      order_name: legacyResult.orderName,
    });
  } catch (error) {
    console.error("[webhook] Processing error:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}
