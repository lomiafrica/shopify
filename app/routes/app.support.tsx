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
  InlineStack,
} from "@shopify/polaris";

// TitleBar handled via <ui-title-bar> web component

export default function SupportPage() {
  return (
    <Page fullWidth>
      <ui-title-bar title="Support" />
      <Layout>
        <Layout.Section>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <Box padding="400">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    Need help with lomi.?
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Get help with your integration or ask questions about our
                    services.
                  </Text>
                  <List type="bullet">
                    <List.Item>
                      Visit our{" "}
                      <Link url="https://docs.lomi.africa" external>
                        documentation
                      </Link>
                      .
                    </List.Item>
                    <List.Item>
                      Check our{" "}
                      <Link url="https://lomi.africa/faq" external>
                        FAQ section if you&apos;re not familiar with our
                        products
                      </Link>
                      .
                    </List.Item>
                    <List.Item>
                      Check our{" "}
                      <Link url="https://status.lomi.africa" external>
                        status page
                      </Link>{" "}
                      to see if there are any ongoing issues.
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
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    Contact support
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Our support team is available 24/7 to help you with any
                    issues. We typically respond within 2-4 hours during
                    business hours.
                  </Text>
                  <InlineStack gap="300">
                    <div style={{ flex: 1 }}>
                      <Button
                        url="mailto:hello@lomi.africa"
                        external
                        variant="primary"
                        fullWidth
                      >
                        Email us
                      </Button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Button
                        url="https://wa.me/2250160223401"
                        external
                        fullWidth
                        variant="secondary"
                      >
                        Send us a WhatsApp
                      </Button>
                    </div>
                  </InlineStack>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
