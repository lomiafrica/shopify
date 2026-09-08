import {
  formatMerchantFacingApiError,
  resolveLomiApiBaseUrl,
} from "./merchant-errors";
import {
  isJsonObject,
  validateJsonValue,
  type JsonObject,
  type JsonValue,
} from "@lomi./shared";

class LomiApiError extends Error {
  status: number;
  details?: JsonValue;
  constructor(message: string, status: number, details?: JsonValue) {
    super(message);
    this.name = "LomiApiError";
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, LomiApiError.prototype);
  }
}

interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  apiKey: string;
  body?: JsonObject;
  params?: { [key: string]: string };
}

async function lomiApiRequest<T_Data>({
  method,
  path,
  apiKey,
  body,
  params,
}: RequestOptions): Promise<T_Data> {
  const baseUrl = resolveLomiApiBaseUrl(apiKey);
  const url = new URL(`${baseUrl}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT")) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url.toString(), config);
    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      const errorDetails = responseBody?.error || responseBody;
      const errorMessage =
        errorDetails?.message ||
        formatMerchantFacingApiError(
          response.status,
          "Request failed",
          apiKey.toLowerCase().includes("_test_"),
        );
      console.error("Lomi API Error:", errorDetails || responseBody);
      throw new LomiApiError(
        errorMessage,
        response.status,
        errorDetails?.details || errorDetails,
      );
    }

    if (response.status === 204) {
      // SAFETY: Boundary value matches the asserted domain type at this call site.
      return undefined as T_Data;
    }

    if (
      responseBody &&
      isJsonObject(responseBody) &&
      "data" in responseBody
    ) {
      // SAFETY: Boundary value matches the asserted domain type at this call site.
      return responseBody.data as T_Data;
    }

    // SAFETY: Boundary value matches the asserted domain type at this call site.
    return responseBody as T_Data;
  } catch (error) {
    console.error("Error during Lomi API request execution:", error);
    if (error instanceof LomiApiError) {
      throw error;
    }
    throw new LomiApiError(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during the Lomi API request",
      // SAFETY: Boundary value matches the asserted domain type at this call site.
      (error as { status?: number }).status || 500,
      isJsonObject(error) ? error : undefined,
    );
  }
}

// --- Checkout Session Types (based on utils/lomi./checkout-sessions-api-docs.md) ---
// These will need to be fleshed out based on the actual API documentation.

// No LineItem interface as it's not directly used in Lomi's Create Checkout Session request body.
// Lomi takes a total 'amount'.

interface CreateCheckoutSessionRequest {
  success_url: string;
  cancel_url: string;
  amount: number; // Amount in smallest currency unit
  currency_code: string; // 3-letter ISO currency code (e.g., "XOF")
  integration_source?:
    | "system"
    | "shopify"
    | "woocommerce"
    | "prestashop"
    | "magento"
    | "odoo"
    | "bubble";
  title?: string;
  description?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  product_id?: string; // UUID
  subscription_id?: string; // UUID
  plan_id?: string; // UUID
  metadata?: Record<string, string>; // Key-value pairs, string values, max 50 keys
  expiration_minutes?: number; // Default: 30
  allow_coupon_code?: boolean; // Default: false
  require_billing_address?: boolean;
}

// This interface represents the structure inside the "data" object of the response
interface CheckoutSession {
  checkout_session_id: string;
  url: string; // URL to redirect the customer to for payment
  status: string; // e.g., "open", "completed", "expired"
  expires_at: string; // ISO 8601 datetime
  created_at: string; // ISO 8601 datetime
  merchant_id: string;
  organization_id: string;
  success_url: string;
  cancel_url: string;
  amount: number;
  currency_code: string;
  title?: string;
  description?: string; // Not in example response, but good to anticipate
  customer_email?: string; // In GET response, could be in create response too
  customer_name?: string; // In GET response
  customer_phone?: string; // In GET response
  metadata?: Record<string, string>; // In GET response
  allow_coupon_code?: boolean;
  environment?: "test" | "live"; // From api-environment.md and example response
}

// --- API Client Functions ---

/**
 * Creates a Lomi Checkout Session.
 * The merchant's Lomi API key must be provided.
 * @param apiKey - The Lomi API key for the merchant.
 * @param data - The data required to create the checkout session.
 * @returns The created checkout session details from Lomi (the content of the 'data' object).
 */
export async function createLomiCheckoutSession(
  apiKey: string,
  data: CreateCheckoutSessionRequest,
): Promise<CheckoutSession> {
  if (!apiKey) {
    throw new LomiApiError(
      "Lomi API key is required to create a checkout session.",
      400,
    );
  }
  const path = "/checkout-sessions";
  const body = validateJsonValue({
    success_url: data.success_url,
    cancel_url: data.cancel_url,
    amount: data.amount,
    currency_code: data.currency_code,
    integration_source: data.integration_source,
    title: data.title,
    description: data.description,
    customer_email: data.customer_email,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    product_id: data.product_id,
    subscription_id: data.subscription_id,
    plan_id: data.plan_id,
    metadata: data.metadata,
    expiration_minutes: data.expiration_minutes,
    allow_coupon_code: data.allow_coupon_code,
    require_billing_address: data.require_billing_address,
  });
  if (!isJsonObject(body)) {
    throw new TypeError("Checkout session body must be a JSON object");
  }
  return lomiApiRequest<CheckoutSession>({
    method: "POST",
    path,
    apiKey,
    body,
  });
}

// TODO: Implement other Lomi API functions as needed:
// - getLomiCheckoutSession(apiKey: string, sessionId: string): Promise<CheckoutSession>
// - listLomiCheckoutSessions(apiKey: string, params?: { limit?: number; page?: number; status?: string }): Promise<CheckoutSession[]> (adjust for pagination meta)
// - getTransactionStatus(apiKey: string, transactionId: string)
// - createRefund(apiKey: string, transactionId: string, amount?: number, reason?: string)
// - etc.
