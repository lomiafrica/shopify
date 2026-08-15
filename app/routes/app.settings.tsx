import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  BlockStack,
  Box,
  Banner,
  InlineStack,
  Checkbox,
  Divider,
  Select,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { supabaseAdmin } from "@/app/lib/supabase/server";
import {
  fetchSetupHealthChecks,
  isTestLomiApiKey,
  type SetupHealthCheck,
} from "@/app/lib/lomi/merchant-errors";

// Loader to check if the shop is already configured
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const webhookUrl = `${url.origin}/api/webhooks/lomi/payment-success`;

  try {
    const { data: settings } = await supabaseAdmin.rpc(
      "get_shopify_shop_settings",
      {
        p_shop: session.shop,
      },
    );

    const shopSettings = settings && settings.length > 0 ? settings[0] : null;
    const requestUrl = new URL(request.url);
    const setupHealth = await fetchSetupHealthChecks(
      shopSettings?.api_key,
      shopSettings?.webhook_secret,
      webhookUrl,
      requestUrl.protocol === "https:",
    );

    return json({
      shop: session.shop,
      isConfigured: shopSettings?.is_configured || false,
      maskedKey: shopSettings?.api_key
        ? shopSettings.api_key.length > 12
          ? shopSettings.api_key.substring(0, 12) + "••••••••••••••••"
          : "••••••••••••••••"
        : null,
      isTestMode: shopSettings?.api_key
        ? isTestLomiApiKey(shopSettings.api_key)
        : true,
      setupHealth,
      maskedWebhookSecret: shopSettings?.webhook_secret
        ? shopSettings.webhook_secret.length > 5
          ? shopSettings.webhook_secret.substring(0, 5) + "••••••••••••••••"
          : "••••••••••••••••"
        : null,
      webhookUrl,
      allowCouponCode: shopSettings?.allow_coupon_code ?? false,
      requireBillingAddress: shopSettings?.require_billing_address ?? true,
      shippingMode: shopSettings?.shipping_mode ?? "subtotal_only",
      flatShippingFee:
        shopSettings?.flat_shipping_fee != null
          ? String(shopSettings.flat_shipping_fee)
          : "",
    });
  } catch (error) {
    console.error("Error loading settings:", error);
    return json({
      shop: session.shop,
      isConfigured: false,
      maskedKey: null,
      maskedWebhookSecret: null,
      webhookUrl,
      // SAFETY: Boundary value matches the asserted domain type at this call site.
      setupHealth: [] as SetupHealthCheck[],
      isTestMode: true,
      allowCouponCode: false,
      requireBillingAddress: true,
      shippingMode: "subtotal_only",
      flatShippingFee: "",
    });
  }
}

export default function SettingsPage() {
  const fetcher = useFetcher();
  const loaderData = useLoaderData<typeof loader>();

  const [apiKey, setApiKey] = useState(loaderData.maskedKey || "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [copied, setCopied] = useState(false);

  // Checkout settings
  const [allowCouponCode, setAllowCouponCode] = useState(loaderData.allowCouponCode);
  const [requireBillingAddress, setRequireBillingAddress] = useState(loaderData.requireBillingAddress);
  const [shippingMode, setShippingMode] = useState(loaderData.shippingMode);
  const [flatShippingFee, setFlatShippingFee] = useState(loaderData.flatShippingFee);

  const shippingModeOptions = [
    { label: "Subtotal only (no shipping on cart pay)", value: "subtotal_only" },
    {
      label: "Subtotal + flat shipping fee",
      value: "subtotal_plus_flat_fee",
    },
  ];

  const isSubmitting = fetcher.state === "submitting";
  // SAFETY: Boundary value matches the asserted domain type at this call site.
  const fetcherResponse = fetcher.data as
    | { success?: boolean; message?: string }
    | undefined;
  const showSuccess = fetcherResponse?.success === true;
  const error =
    fetcherResponse?.success === false ? fetcherResponse.message : null;
  const isConfigured = loaderData.isConfigured || showSuccess;

  const handleSubmit = useCallback(() => {
    if (!apiKey.trim()) {
      return;
    }

    const formData = new FormData();
    formData.append("lomiApiKey", apiKey);
    if (webhookSecret.trim()) {
      formData.append("lomiWebhookSecret", webhookSecret);
    }
    // Add checkout settings
    formData.append("allowCouponCode", String(allowCouponCode));
    formData.append("requireBillingAddress", String(requireBillingAddress));
    formData.append("shippingMode", shippingMode);
    formData.append("flatShippingFee", flatShippingFee);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/validate-lomi-key",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiKey,
    webhookSecret,
    allowCouponCode,
    requireBillingAddress,
    shippingMode,
    flatShippingFee,
  ]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(loaderData.webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [loaderData.webhookUrl]);

  return (
    <Page fullWidth>
      <ui-title-bar title="Settings" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Banner title="Cart payment integration" tone="info">
              <p>
                This app lets customers pay from the cart with lomi. (mobile
                money, cards, and more). It is distributed as a custom install
                app — not a native Shopify payment method in checkout.
              </p>
            </Banner>

            {showSuccess && (
              <Banner title="Connected to lomi." tone="success">
                <p>
                  Your store is now connected. Add the &ldquo;Pay with
                  lomi.&rdquo; block to your cart page in the theme editor.
                </p>
              </Banner>
            )}

            {error && (
              <Banner title="Error" tone="critical">
                <p>{error}</p>
              </Banner>
            )}

            {isConfigured && !showSuccess && (
              <Banner title="Connected" tone="success">
                <p>
                  Your store is connected to lomi. with key:{" "}
                  {loaderData.maskedKey}
                  {loaderData.isTestMode
                    ? " (test mode — sandbox API)"
                    : " (live mode)"}
                </p>
              </Banner>
            )}

            {loaderData.setupHealth.length > 0 && (
              <Card roundedAbove="sm">
                <Box padding="400">
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h2">
                      Setup health
                    </Text>
                    <BlockStack gap="200">
                      {loaderData.setupHealth.map((check) => (
                        <InlineStack
                          key={check.label}
                          align="space-between"
                          blockAlign="start"
                          wrap={false}
                        >
                          <Text as="span" fontWeight="semibold">
                            {check.label}
                          </Text>
                          <Text as="span" tone="subdued">
                            {check.message}
                          </Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                    <Text as="p" tone="subdued">
                      Test and live keys use different webhook secrets. Paste the
                      matching pair from Dashboard → Developers when switching
                      modes.
                    </Text>
                  </BlockStack>
                </Box>
              </Card>
            )}

            <Card roundedAbove="sm">
              <Box padding="400">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    {isConfigured ? "Update access tokens" : "Connect to lomi."}
                  </Text>
                  <Text as="p" tone="subdued">
                    Configure your access tokens to enable payments.
                  </Text>
                  <Box paddingBlockStart="200">
                    <FormLayout>
                      <TextField
                        label="Secret key"
                        value={apiKey}
                        onChange={setApiKey}
                        type="password"
                        autoComplete="off"
                        placeholder="lomi_sk_..."
                        helpText={
                          loaderData.maskedKey ? (
                            <span>
                              Your current api key is shown above. To update it,
                              replace the masked values with a new key. Use a
                              test key (`lomi_sk_test_…`) for sandbox or a live
                              key for production.
                            </span>
                          ) : (
                            <span>
                              You can create a new API key in the{" "}
                              <a
                                href="https://dashboard.lomi.africa/settings/access-tokens"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: "underline" }}
                              >
                                dashboard
                              </a>
                              .
                            </span>
                          )
                        }
                        requiredIndicator
                      />

                      <Box paddingBlockStart="200">
                        <Text variant="headingSm" as="h3">
                          Webhook configuration
                        </Text>
                        <Text as="p" tone="subdued">
                          Required to sync payment status to Shopify orders.
                        </Text>
                      </Box>

                      <TextField
                        label="Your Webhook URL"
                        value={loaderData.webhookUrl}
                        autoComplete="off"
                        readOnly
                        helpText="Create a new webhook with this endpoint in your lomi. merchant dashboard."
                        connectedRight={
                          <Button
                            onClick={handleCopyUrl}
                            accessibilityLabel="Copy Webhook URL"
                            size="large"
                          >
                            {copied ? "Copied!" : "Copy"}
                          </Button>
                        }
                      />

                      <TextField
                        label="Webhook Secret"
                        value={webhookSecret}
                        onChange={setWebhookSecret}
                        type="password"
                        autoComplete="off"
                        placeholder={
                          loaderData.maskedWebhookSecret || "whsec_..."
                        }
                        helpText={
                          loaderData.maskedWebhookSecret
                            ? "Secret is configured. Enter a new one to update."
                            : "Paste the secret you receive after creating the webhook."
                        }
                      />

                      <Box paddingBlockStart="300">
                        <Divider />
                      </Box>

                      <Box paddingBlockStart="200">
                        <Text variant="headingSm" as="h3">
                          Checkout options
                        </Text>
                        <Text as="p" tone="subdued">
                          Customize the lomi. checkout experience for your customers.
                        </Text>
                      </Box>

                      <Checkbox
                        label="Enable lomi. discount codes"
                        checked={allowCouponCode}
                        onChange={setAllowCouponCode}
                        helpText="Allow customers to apply lomi. discount codes at checkout."
                      />

                      <Checkbox
                        label="Require billing address"
                        checked={requireBillingAddress}
                        onChange={setRequireBillingAddress}
                        helpText="Require customers to enter their billing address during checkout."
                      />

                      <Select
                        label="Shipping amount on cart pay"
                        options={shippingModeOptions}
                        onChange={setShippingMode}
                        value={shippingMode}
                        helpText="Cart bypass cannot read Shopify checkout shipping rates. Choose how much to charge before redirecting to lomi."
                      />

                      {shippingMode === "subtotal_plus_flat_fee" ? (
                        <TextField
                          label="Flat shipping fee"
                          type="number"
                          value={flatShippingFee}
                          onChange={setFlatShippingFee}
                          autoComplete="off"
                          helpText="Added to the cart subtotal on the Shopify draft order (shop currency)."
                        />
                      ) : null}

                      <Box paddingBlockStart="400">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                          }}
                        >
                          <Button
                            onClick={handleSubmit}
                            loading={isSubmitting}
                            variant="primary"
                          >
                            {isConfigured
                              ? "Update connection"
                              : "Connect to lomi."}
                          </Button>
                        </div>
                      </Box>
                    </FormLayout>
                  </Box>
                </BlockStack>
              </Box>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            <Card roundedAbove="sm">
              <BlockStack gap="200">
                <Box padding="400">
                  <Text variant="headingMd" as="h2">
                    Need some assistance?
                  </Text>
                  <Box paddingBlockStart="200">
                    <Text as="p" variant="bodyMd">
                      Visit our docs to learn how to get started with lomi. on
                      Shopify.
                    </Text>
                  </Box>
                  <Box paddingBlockStart="200">
                    <div
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      <Button
                        url="https://docs.lomi.africa/build/ecommerce-extensions/shopify"
                        external
                        variant="plain"
                      >
                        Documentation
                      </Button>
                    </div>
                  </Box>
                </Box>
              </BlockStack>
            </Card>

            {isConfigured && (
              <Card roundedAbove="sm">
                <BlockStack gap="200">
                  <Box padding="400">
                    <Text variant="headingMd" as="h2">
                      Next Steps
                    </Text>
                    <Box paddingBlockStart="200">
                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="start">
                          <Text as="span" fontWeight="bold">
                            1.
                          </Text>
                          <Text as="span">
                            Online Store → Themes → Customize
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="start">
                          <Text as="span" fontWeight="bold">
                            2.
                          </Text>
                          <Text as="span">Open the Cart template</Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="start">
                          <Text as="span" fontWeight="bold">
                            3.
                          </Text>
                          <Text as="span">
                            Add the &ldquo;Pay with lomi.&rdquo; app block
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="start">
                          <Text as="span" fontWeight="bold">
                            4.
                          </Text>
                          <Text as="span">
                            Save, add items to cart, and test payment
                          </Text>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </Box>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
