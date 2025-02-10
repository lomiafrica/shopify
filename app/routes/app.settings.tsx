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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "@remix-run/react";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const settings = await response.json();
          setApiKey(settings.api_key || "");
          setApiSecret(settings.api_secret || "");
          setMerchantId(settings.merchant_id || "");
          setWebhookUrl(settings.webhook_url || "");
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    }
    loadSettings();
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          merchant_id: merchantId,
          webhook_url: webhookUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, apiSecret, merchantId, webhookUrl]);

  const handleBack = useCallback(() => {
    navigate("/app");
  }, [navigate]);

  return (
    <Page
      backAction={{
        content: "Back",
        onAction: handleBack,
      }}
    >
      <TitleBar title="Settings" />
      <Layout>
        <Layout.Section>
          {showSuccess && (
            <Box paddingBlock="400">
              <Banner title="Success" tone="success">
                Settings have been saved successfully.
              </Banner>
            </Box>
          )}
          {error && (
            <Box paddingBlock="400">
              <Banner title="Error" tone="critical">
                {error}
              </Banner>
            </Box>
          )}
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  API Configuration
                </Text>
              </Box>
              <Box padding="400">
                <FormLayout>
                  <TextField
                    label="API Key"
                    value={apiKey}
                    onChange={setApiKey}
                    type="password"
                    autoComplete="off"
                    helpText="Your lomi. API key"
                  />
                  <TextField
                    label="API Secret"
                    value={apiSecret}
                    onChange={setApiSecret}
                    type="password"
                    autoComplete="off"
                    helpText="Your lomi. API secret"
                  />
                  <TextField
                    label="Merchant ID"
                    value={merchantId}
                    onChange={setMerchantId}
                    autoComplete="off"
                    helpText="Your lomi. merchant ID"
                  />
                  <TextField
                    label="Webhook URL"
                    value={webhookUrl}
                    onChange={setWebhookUrl}
                    autoComplete="off"
                    helpText="URL for receiving webhook notifications"
                  />
                  <Box paddingBlockStart="400">
                    <Button
                      onClick={handleSave}
                      loading={isSaving}
                      variant="primary"
                    >
                      Save Settings
                    </Button>
                  </Box>
                </FormLayout>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card roundedAbove="sm">
            <BlockStack gap="200">
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  Need Help?
                </Text>
                <Box paddingBlockStart="200">
                  <Text as="p" variant="bodyMd">
                    Visit our{" "}
                    <Button
                      url="https://developers.lomi.africa/"
                      external
                      variant="plain"
                    >
                      documentation
                    </Button>{" "}
                    to learn how to get your API keys and set up custom integrations.
                  </Text>
                </Box>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
