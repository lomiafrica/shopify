/** Line item shape from Shopify storefront /cart.js */
export interface CartJsItem {
  id: number;
  variant_id: number;
  product_id: number;
  title: string;
  quantity: number;
  price: number;
  line_price: number;
  sku?: string;
  vendor?: string;
  product_title?: string;
  variant_title?: string;
}

export type ShopifyShippingMode = "subtotal_only" | "subtotal_plus_flat_fee";

export interface ShopifyShopSettings {
  api_key: string | null;
  webhook_secret: string | null;
  is_configured: boolean;
  allow_coupon_code: boolean;
  require_billing_address: boolean;
  shipping_mode: ShopifyShippingMode;
  flat_shipping_fee: number | null;
}

export interface DraftOrderResult {
  draftOrderId: string;
  draftOrderName: string;
  totalAmount: number;
  currencyCode: string;
}
