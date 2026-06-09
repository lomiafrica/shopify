import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import shopify, { authenticate } from "../shopify.server";
import { startCartPayment } from "@/app/lib/shopify/cart-pay.server";
import type { CartJsItem } from "@/app/lib/shopify/types";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);

  if (!session?.shop) {
    return json({ error: "Unauthorized app proxy request" }, { status: 401 });
  }

  let body: { items?: CartJsItem[]; customerEmail?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cartItems = body.items ?? [];
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return json({ error: "Cart is empty" }, { status: 400 });
  }

  const offlineSessionId = `offline_${session.shop}`;
  const adminSession =
    (await shopify.sessionStorage.loadSession(offlineSessionId)) ?? session;

  if (!adminSession.accessToken) {
    return json({ error: "Shop session not available" }, { status: 503 });
  }

  try {
    const result = await startCartPayment({
      shop: session.shop,
      session: adminSession,
      cartItems,
      customerEmail: body.customerEmail,
    });

    return json({
      checkout_url: result.checkout_url,
      draft_order_id: result.draft_order_id,
      draft_order_name: result.draft_order_name,
    });
  } catch (error) {
    console.error("[cart-pay] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to start payment";
    return json({ error: message }, { status: 500 });
  }
}

export async function loader({ request }: ActionFunctionArgs) {
  await authenticate.public.appProxy(request);
  return json({ status: "ok", endpoint: "cart-pay" });
}
