import type { Session } from "@shopify/shopify-api";
import { supabaseAdmin } from "@/app/lib/supabase/server";
import { createLomiCheckoutSession } from "@/app/lib/lomi/server";
import { createDraftOrderFromCart } from "./draft-order.server";
import type { CartJsItem, ShopifyShopSettings } from "./types";

function getAppOrigin(): string {
  return (
    process.env.SHOPIFY_APP_URL?.replace(/\/$/, "") ||
    "https://connect.lomi.africa"
  );
}

export async function loadShopSettings(
  shop: string,
): Promise<ShopifyShopSettings | null> {
  const { data, error } = await supabaseAdmin.rpc("get_shopify_shop_settings", {
    p_shop: shop,
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  const row = data[0];
  return {
    api_key: row.api_key ?? null,
    webhook_secret: row.webhook_secret ?? null,
    is_configured: Boolean(row.is_configured),
    allow_coupon_code: row.allow_coupon_code ?? false,
    require_billing_address: row.require_billing_address ?? true,
    shipping_mode:
      row.shipping_mode === "subtotal_plus_flat_fee"
        ? "subtotal_plus_flat_fee"
        : "subtotal_only",
    flat_shipping_fee:
      row.flat_shipping_fee != null ? Number(row.flat_shipping_fee) : null,
  };
}

interface StartCartPaymentParams {
  shop: string;
  session: Session;
  cartItems: CartJsItem[];
  customerEmail?: string;
}

export interface CartPaymentResult {
  checkout_url: string;
  draft_order_id: string;
  draft_order_name: string;
}

export async function startCartPayment({
  shop,
  session,
  cartItems,
  customerEmail,
}: StartCartPaymentParams): Promise<CartPaymentResult> {
  const settings = await loadShopSettings(shop);

  if (!settings?.api_key || !settings.is_configured) {
    throw new Error("Shop is not configured for lomi. payments");
  }

  if (!cartItems.length) {
    throw new Error("Cart is empty");
  }

  const draft = await createDraftOrderFromCart({
    session,
    cartItems,
    shippingMode: settings.shipping_mode,
    flatShippingFee: settings.flat_shipping_fee,
    customerEmail,
    transactionNote: "Awaiting lomi. payment from cart",
  });

  const appOrigin = getAppOrigin();
  const encodedDraft = encodeURIComponent(draft.draftOrderId);

  const lomiSession = await createLomiCheckoutSession(settings.api_key, {
    description: `Shopify order ${draft.draftOrderName}`,
    currency_code: draft.currencyCode,
    success_url: `${appOrigin}/shopify/order-complete?shop=${encodeURIComponent(shop)}&draft=${encodedDraft}`,
    cancel_url: `https://${shop}/cart`,
    amount: draft.totalAmount,
    integration_source: "shopify",
    allow_coupon_code: settings.allow_coupon_code,
    require_billing_address: settings.require_billing_address,
    customer_email: customerEmail,
    metadata: {
      shopify_shop: shop,
      shopify_draft_order_id: draft.draftOrderId,
      shopify_draft_order_name: draft.draftOrderName,
      plugin: "shopify-lomi",
    },
  });

  const checkoutUrl =
    lomiSession.url ||
    // SAFETY: Boundary value matches the asserted domain type at this call site.
    (lomiSession as { checkout_url?: string }).checkout_url;

  if (!checkoutUrl) {
    throw new Error("Lomi did not return a checkout URL");
  }

  await supabaseAdmin.rpc("upsert_shopify_pending_payment", {
    p_draft_order_id: draft.draftOrderId,
    p_shop_domain: shop,
    p_checkout_session_id: lomiSession.checkout_session_id || null,
  });

  return {
    checkout_url: checkoutUrl,
    draft_order_id: draft.draftOrderId,
    draft_order_name: draft.draftOrderName,
  };
}
