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
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { supabaseAdmin } from "@/app/lib/supabase/server";

// TitleBar handled via <ui-title-bar> web component

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

    return json({
      isConfigured: shopSettings?.is_configured || false,
      maskedKey: shopSettings?.api_key
        ? shopSettings.api_key.length > 12
          ? shopSettings.api_key.substring(0, 12) + "••••••••••••••••"
          : "••••••••••••••••"
        : null,
      maskedWebhookSecret: shopSettings?.webhook_secret
        ? shopSettings.webhook_secret.length > 5
          ? shopSettings.webhook_secret.substring(0, 5) + "••••••••••••••••"
          : "••••••••••••••••"
        : null,
      webhookUrl,
    });
  } catch (error) {
    console.error("Error loading settings:", error);
    return json({
      isConfigured: false,
      maskedKey: null,
      maskedWebhookSecret: null,
      webhookUrl,
    });
  }
}

export default function SettingsPage() {
  const fetcher = useFetcher();
  const loaderData = useLoaderData<typeof loader>();

  const [apiKey, setApiKey] = useState(loaderData.maskedKey || "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [copied, setCopied] = useState(false);

  const isSubmitting = fetcher.state === "submitting";
  const fetcherResponse = fetcher.data as
    | { success?: boolean; message?: string }
    | undefined;
  const showSuccess = fetcherResponse?.success === true;
  const error =
    fetcherResponse?.success === false ? fetcherResponse.message : null;
  const isConfigured = loaderData.isConfigured || showSuccess;

  // Note: Form clearing after success removed to avoid setState in effect

  const handleSubmit = useCallback(() => {
    if (!apiKey.trim()) {
      // Error will be shown from fetcher response
      return;
    }

    const formData = new FormData();
    formData.append("lomiApiKey", apiKey);
    if (webhookSecret.trim()) {
      formData.append("lomiWebhookSecret", webhookSecret);
    }

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/validate-lomi-key",
    });
    // Note: `fetcher` is intentionally excluded from dependencies as it changes identity on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, webhookSecret]);

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
            {showSuccess && (
              <Banner title="Connected to lomi." tone="success">
                <p>
                  Your store is now connected. Add the checkout extension to
                  start accepting payments.
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
                </p>
              </Banner>
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
                              replace the masked values with a new key.
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
                        url="https://docs.lomi.africa/"
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
                          <Text as="span">Go to Settings → Checkout</Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="start">
                          <Text as="span" fontWeight="bold">
                            2.
                          </Text>
                          <Text as="span">Click Customize</Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="start">
                          <Text as="span" fontWeight="bold">
                            3.
                          </Text>
                          <Text as="span">
                            Add &ldquo;lomi. Checkout&rdquo; block
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="start">
                          <Text as="span" fontWeight="bold">
                            4.
                          </Text>
                          <Text as="span">Save and test!</Text>
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
