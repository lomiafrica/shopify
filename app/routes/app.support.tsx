import {
  Page,
  Layout,
  Card,
  BlockStack,
  Box,
  Text,
  Button,
  List,
  Link,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate } from "@remix-run/react";
import { useCallback } from "react";

export default function SupportPage() {
  const navigate = useNavigate();

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
      <TitleBar title="Support" />
      <Layout>
        <Layout.Section>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  Need help with lomi.?
                </Text>
              </Box>
              <Box padding="400">
                <BlockStack gap="400">
                  <Text as="p" variant="bodyMd">
                    Get help with your integration or ask questions about our
                    services.
                  </Text>
                  <List type="bullet">
                    <List.Item>
                      View our{" "}
                      <Link url="https://developers.lomi.africa" external>
                        API documentation
                      </Link>
                    </List.Item>
                    <List.Item>
                      Check our{" "}
                      <Link url="https://lomi.africa/faq" external>
                        FAQ section
                      </Link>
                    </List.Item>
                    <List.Item>
                      Join our{" "}
                      <Link url="https://discord.gg/lomi" external>
                        Discord community
                      </Link>
                    </List.Item>
                  </List>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <Box padding="400">
                <Text variant="headingMd" as="h2">
                  Contact Support
                </Text>
              </Box>
              <Box padding="400">
                <BlockStack gap="400">
                  <Text as="p" variant="bodyMd">
                    Our support team is available 24/7 to help you with any
                    issues.
                  </Text>
                  <Button
                    url="mailto:support@lomi.africa"
                    external
                    variant="primary"
                  >
                    Email Support
                  </Button>
                  <Button url="https://wa.me/2250700000000" external>
                    WhatsApp Support
                  </Button>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
