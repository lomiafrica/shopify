import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  List,
  Link,
  InlineStack,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // TODO: Fetch actual stats from your backend
  return {
    stats: {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalAmount: "0.00",
    },
    recentTransactions: [],
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const { stats } = useFetcher<typeof loader>().data || {
    stats: {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalAmount: "0.00",
    }
  };

  return (
    <Page>
      <TitleBar title="Welcome !" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Welcome to your lomi. dashboard on Shopify 🌟
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Monitor your transactions, configure settings, and get support all in one place.
                  </Text>
                </BlockStack>

                {/* Stats Overview */}
                <InlineStack gap="300" wrap={false} align="start">
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd" tone="subdued">Total Transactions</Text>
                      <Text as="p" variant="heading3xl">{stats.totalTransactions}</Text>
                    </BlockStack>
                  </Card>
                  <Card background="bg-surface-success">
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd" tone="success">Successful</Text>
                      <Text as="p" variant="heading3xl" tone="success">{stats.successfulTransactions}</Text>
                    </BlockStack>
                  </Card>
                  <Card background="bg-surface-critical">
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd" tone="critical">Failed</Text>
                      <Text as="p" variant="heading3xl" tone="critical">{stats.failedTransactions}</Text>
                    </BlockStack>
                  </Card>
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">Total Amount</Text>
                      <Text as="p" variant="heading3xl">${stats.totalAmount}</Text>
                    </BlockStack>
                  </Card>
                </InlineStack>

                {/* Recent Transactions */}
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingMd">
                        Recent Transactions
                      </Text>
                      <Link url="/app/transactions" removeUnderline>View all</Link>
                    </InlineStack>
                    <DataTable
                      columnContentTypes={[
                        'text',
                        'text',
                        'numeric',
                        'text',
                        'text',
                      ]}
                      headings={[
                        'Transaction ID',
                        'Date',
                        'Amount',
                        'Status',
                        'Customer',
                      ]}
                      rows={[
                        [
                          'No transactions yet',
                          '-',
                          '-',
                          '-',
                          '-',
                        ],
                      ]}
                    />
                  </BlockStack>
                </Card>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Actions
                  </Text>
                  <List type="bullet">
                    <List.Item>
                      <Link url="/app/settings" removeUnderline>
                        Configure your API keys
                      </Link>
                    </List.Item>
                    <List.Item>
                      <Link url="/app/support" removeUnderline>
                        Get support
                      </Link>
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Resources
                  </Text>
                  <List type="bullet">
                    <List.Item>
                      <Link
                        url="https://developers.lomi.africa/"
                        target="_blank"
                        removeUnderline
                      >
                        API documentation
                      </Link>
                    </List.Item>
                    <List.Item>
                      <Link
                        url="https://developers.lomi.africa/open-source"
                        target="_blank"
                        removeUnderline
                      >
                        lomi. is open source
                      </Link>
                    </List.Item>
                    <List.Item>
                      <Link
                        url="https://status.lomi.africa"
                        target="_blank"
                        removeUnderline
                      >
                        System status
                      </Link>
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
