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
import { useState, useCallback, useEffect } from "react";
import { useNavigate, useFetcher, useLoaderData } from "@remix-run/react";
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
          ? shopSettings.api_key.substring(0, 12) + "••••••••"
          : "••••••••"
        : null,
      maskedWebhookSecret: shopSettings?.webhook_secret
        ? shopSettings.webhook_secret.length > 5
          ? shopSettings.webhook_secret.substring(0, 5) + "••••••••"
          : "••••••••"
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
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const loaderData = useLoaderData<typeof loader>();

  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isSubmitting = fetcher.state === "submitting";
  const isConfigured = loaderData.isConfigured || showSuccess;

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data) {
      const data = fetcher.data as { success?: boolean; message?: string };
      if (data.success) {
        setShowSuccess(true);
        setError(null);
        setApiKey("");
        setWebhookSecret("");
      } else if (data.message) {
        setError(data.message);
        setShowSuccess(false);
      }
    }
  }, [fetcher.data]);

  const handleSubmit = useCallback(() => {
    if (!apiKey.trim()) {
      setError("Secret Key is required");
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
  }, [apiKey, webhookSecret, fetcher]);

  const handleBack = useCallback(() => {
    navigate("/app");
  }, [navigate]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(loaderData.webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [loaderData.webhookUrl]);

  return (
    <Page
      fullWidth
      backAction={{
        content: "Back",
        onAction: handleBack,
      }}
    >
      <ui-title-bar title="Settings" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {showSuccess && (
              <Banner
                title="Connected to lomi."
                tone="success"
                onDismiss={() => setShowSuccess(false)}
              >
                <p>
                  Your store is now connected. Add the checkout extension to
                  start accepting payments.
                </p>
              </Banner>
            )}

            {error && (
              <Banner
                title="Error"
                tone="critical"
                onDismiss={() => setError(null)}
              >
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
              <BlockStack gap="400">
                <Box padding="400">
                  <Text variant="headingMd" as="h2">
                    {isConfigured ? "Update API Key" : "Connect to lomi."}
                  </Text>
                  <Box paddingBlockStart="200">
                    <Text as="p" tone="subdued">
                      Configure your API keys to enable payments.
                    </Text>
                  </Box>
                </Box>
                <Box padding="400">
                  <FormLayout>
                    <TextField
                      label="Secret Key"
                      value={apiKey}
                      onChange={setApiKey}
                      type="password"
                      autoComplete="off"
                      placeholder="lomi_sk_... or lomi_sk_test_..."
                      helpText={
                        <span>
                          From{" "}
                          <a
                            href="https://dashboard.lomi.africa/settings/access-tokens"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: "underline" }}
                          >
                            lomi. Dashboard
                          </a>{" "}
                          → Developers → API Keys.
                        </span>
                      }
                      requiredIndicator
                    />

                    <Box paddingBlockStart="200">
                      <Text variant="headingSm" as="h3">
                        Webhook Configuration
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
                      helpText="Copy this URL and add it to your lomi. Dashboard Webhooks."
                      connectedRight={
                        <Button
                          onClick={handleCopyUrl}
                          accessibilityLabel="Copy Webhook URL"
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
                      <Button
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        variant="primary"
                      >
                        {isConfigured
                          ? "Update Connection"
                          : "Connect to lomi."}
                      </Button>
                    </Box>
                  </FormLayout>
                </Box>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            <Card roundedAbove="sm">
              <BlockStack gap="200">
                <Box padding="400">
                  <Text variant="headingMd" as="h2">
                    Need Help?
                  </Text>
                  <Box paddingBlockStart="200">
                    <Text as="p" variant="bodyMd">
                      Visit our documentation to learn how to get your API keys.
                    </Text>
                  </Box>
                  <Box paddingBlockStart="400">
                    <Button
                      url="https://docs.lomi.africa/"
                      external
                      variant="plain"
                    >
                      View Documentation
                    </Button>
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
                          <Text as="span">Add "lomi. Checkout" block</Text>
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
