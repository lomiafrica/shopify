export function resolveLomiApiBaseUrl(apiKey: string): string {
  const key = apiKey.toLowerCase();
  if (key.includes("_test_") || key.includes("sk_test")) {
    return "https://sandbox.api.lomi.africa";
  }
  return "https://api.lomi.africa";
}

export function isTestLomiApiKey(apiKey: string): boolean {
  const key = apiKey.toLowerCase();
  return key.includes("_test_") || key.includes("sk_test");
}

export function formatMerchantFacingApiError(
  httpCode: number,
  detail: string,
  testMode: boolean,
  reference?: string,
): string {
  const ref = reference ? ` ${reference}` : "";
  const modeLabel = testMode ? "test" : "live";

  switch (httpCode) {
    case 401:
      return `Invalid secret API key for ${modeLabel} mode. Copy the key from Dashboard → Developers → API keys and ensure the key matches your environment.${ref}`;
    case 403:
      return `This API key cannot perform this action. Check key permissions in the lomi. dashboard.${ref}`;
    case 404:
      return `lomi. could not find this resource. Confirm test/live mode matches the keys in your dashboard.${ref}`;
    case 422:
      return `Payment could not be created: ${detail}.${ref}`;
    default:
      return `lomi. returned an error (${httpCode}): ${detail}.${ref} See docs.lomi.africa/build/ecommerce-extensions/shopify.`;
  }
}

export type SetupHealthCheck = {
  label: string;
  status: "ok" | "warning" | "error" | "info";
  message: string;
};

export async function fetchSetupHealthChecks(
  apiKey: string | null | undefined,
  webhookSecret: string | null | undefined,
  webhookUrl: string,
  isHttps: boolean,
): Promise<SetupHealthCheck[]> {
  const testMode = apiKey ? isTestLomiApiKey(apiKey) : true;
  const checks: SetupHealthCheck[] = [
    {
      label: "API secret key",
      status: apiKey ? "ok" : "error",
      message: apiKey
        ? "Configured"
        : "Missing — paste your test or live secret key below.",
    },
    {
      label: "Webhook signing secret",
      status: webhookSecret ? "ok" : "warning",
      message: webhookSecret
        ? "Configured"
        : "Recommended — required to verify PAYMENT_SUCCEEDED and REFUND_COMPLETED.",
    },
    {
      label: "HTTPS",
      status: isHttps ? "ok" : "warning",
      message: isHttps
        ? "Enabled"
        : "Not detected on the app host — use HTTPS in production.",
    },
    {
      label: "Test mode",
      status: testMode ? "warning" : "ok",
      message: testMode ? "Sandbox API (test key)" : "Live API (live key)",
    },
    {
      label: "Webhook URL",
      status: "info",
      message: "Copy into Dashboard → Webhooks: " + webhookUrl,
    },
    {
      label: "Webhook events",
      status: "info",
      message:
        "Enable PAYMENT_SUCCEEDED and REFUND_COMPLETED in the lomi. dashboard.",
    },
  ];

  if (!apiKey) {
    return checks;
  }

  const baseUrl = resolveLomiApiBaseUrl(apiKey);
  try {
    const response = await fetch(`${baseUrl}/me`, {
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
    });
    const body = await response.json().catch(() => null);
    const reference =
      body?.request_id != null
        ? `(Reference: ${String(body.request_id)})`
        : body?.correlation_id != null
          ? `(Reference: ${String(body.correlation_id)})`
          : undefined;

    if (!response.ok) {
      const detail =
        (body && (body.message || body.error?.message)) || "Request failed";
      checks.push({
        label: "API connection",
        status: "error",
        message: formatMerchantFacingApiError(
          response.status,
          String(detail),
          testMode,
          reference,
        ),
      });
      return checks;
    }

    checks.push({
      label: "API connection",
      status: "ok",
      message: "GET /me succeeded",
    });
  } catch {
    checks.push({
      label: "API connection",
      status: "error",
      message:
        "Could not reach lomi. API. Check your network and API key, then try again.",
    });
  }

  return checks;
}
