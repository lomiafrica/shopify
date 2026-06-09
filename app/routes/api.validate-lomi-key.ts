import type { ActionFunctionArgs } from "@remix-run/node";
import { data } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { supabaseAdmin } from "../lib/supabase/server";

interface ActionData {
  success: boolean;
  message: string;
  store_id?: string;
  organization_id?: string;
  lomi_api_key_masked?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  if (!admin || !session) {
    return data<ActionData>(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const shopDomain = session.shop;
  let lomiApiKey = "";
  let webhookSecret: string | null = null;
  let allowCouponCode = false;
  let requireBillingAddress = true;
  let shippingMode = "subtotal_only";
  let flatShippingFee = "";

  try {
    const formData = await request.formData();
    const keyFromForm = formData.get("lomiApiKey");
    if (typeof keyFromForm !== "string" || !keyFromForm.trim()) {
      return data<ActionData>(
        { success: false, message: "lomi. Secret Key is required." },
        { status: 400 },
      );
    }
    lomiApiKey = keyFromForm.trim();

    const secretFromForm = formData.get("lomiWebhookSecret");
    if (typeof secretFromForm === "string" && secretFromForm.trim()) {
      webhookSecret = secretFromForm.trim();
    }

    // Read checkout settings
    const allowCouponCodeFromForm = formData.get("allowCouponCode");
    allowCouponCode = allowCouponCodeFromForm === "true";

    const requireBillingAddressFromForm = formData.get("requireBillingAddress");
    requireBillingAddress = requireBillingAddressFromForm !== "false"; // Default to true

    const shippingModeFromForm = formData.get("shippingMode");
    if (typeof shippingModeFromForm === "string" && shippingModeFromForm.trim()) {
      shippingMode = shippingModeFromForm.trim();
    }

    const flatShippingFeeFromForm = formData.get("flatShippingFee");
    if (typeof flatShippingFeeFromForm === "string") {
      flatShippingFee = flatShippingFeeFromForm.trim();
    }
  } catch (error) {
    console.error("Error parsing form data:", error);
    return data<ActionData>(
      { success: false, message: "Invalid request data." },
      { status: 400 },
    );
  }

  if (!supabaseAdmin) {
    console.error("Supabase admin client not initialized.");
    return data<ActionData>(
      { success: false, message: "Server configuration error." },
      { status: 500 },
    );
  }

  try {
    // Step 1: Validate the API key using verify_api_key RPC
    // This returns merchant_id, organization_id, environment, etc.
    const { data: keyData, error: keyError } = await supabaseAdmin.rpc(
      "verify_api_key",
      {
        p_api_key: lomiApiKey,
        p_endpoint: "shopify_app_setup",
        p_request_method: "POST",
      },
    );

    if (keyError) {
      console.error("Error verifying API key:", keyError);
      return data<ActionData>(
        { success: false, message: "Failed to verify API key." },
        { status: 500 },
      );
    }

    if (!keyData || keyData.length === 0) {
      return data<ActionData>(
        {
          success: false,
          message: "Invalid API key. Please check your key and try again.",
        },
        { status: 400 },
      );
    }

    const validatedKey = keyData[0];

    if (!validatedKey.is_valid) {
      return data<ActionData>(
        {
          success: false,
          message: validatedKey.message || "API key validation failed.",
        },
        { status: 400 },
      );
    }

    const organizationId = validatedKey.organization_id;
    const merchantId = validatedKey.merchant_id;

    if (!organizationId) {
      return data<ActionData>(
        {
          success: false,
          message: "API key is not associated with an organization.",
        },
        { status: 400 },
      );
    }

    // Step 2: Install/update the Shopify store using the RPC
    // This creates or updates the store entry and links it to the organization
    const { data: storeId, error: storeError } = await supabaseAdmin.rpc(
      "install_shopify_store",
      {
        p_organization_id: organizationId,
        p_shop_domain: shopDomain,
        p_access_token: session.accessToken || "",
        p_scope: session.scope?.split(",") || [],
      },
    );

    if (storeError) {
      console.error("Error installing Shopify store:", storeError);
      return data<ActionData>(
        { success: false, message: "Failed to register store with lomi." },
        { status: 500 },
      );
    }

    if (!storeId) {
      return data<ActionData>(
        { success: false, message: "Failed to get store ID." },
        { status: 500 },
      );
    }

    // Step 3: Store the API key in shopify_api_keys using upsert_shopify_shop_settings RPC
    const parsedFlatFee =
      flatShippingFee && shippingMode === "subtotal_plus_flat_fee"
        ? parseFloat(flatShippingFee)
        : null;

    const { error: settingsError } = await supabaseAdmin.rpc(
      "upsert_shopify_shop_settings",
      {
        p_shop: shopDomain,
        p_api_key: lomiApiKey,
        p_api_secret: "", // Not used
        p_merchant_id: merchantId?.toString() || "",
        p_webhook_secret: webhookSecret || "",
        p_allow_coupon_code: allowCouponCode,
        p_require_billing_address: requireBillingAddress,
        p_shipping_mode: shippingMode,
        p_flat_shipping_fee:
          parsedFlatFee != null && Number.isFinite(parsedFlatFee)
            ? parsedFlatFee
            : null,
      },
    );

    if (settingsError) {
      console.error("Error storing API key:", settingsError);
      return data<ActionData>(
        { success: false, message: "Failed to store API key configuration." },
        { status: 500 },
      );
    }

    // Create masked key for display
    const maskedKey = lomiApiKey.substring(0, 12) + "••••••••";

    console.log(
      `Successfully configured lomi. for shop ${shopDomain} with org ${organizationId}`,
    );

    return data<ActionData>({
      success: true,
      message:
        "lomi. connected successfully! Add the cart payment block in your theme editor.",
      store_id: storeId,
      organization_id: organizationId,
      lomi_api_key_masked: maskedKey,
    });
  } catch (error) {
    console.error(
      `Unexpected error in /api/validate-lomi-key for shop ${shopDomain}:`,
      error,
    );
    let errorMessage = "Internal server error during key validation.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return data<ActionData>(
      { success: false, message: errorMessage },
      { status: 500 },
    );
  }
}
