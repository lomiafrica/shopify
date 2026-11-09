import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigation, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  Banner,
  EmptyState,
  Button,
  CalloutCard,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "@/app/lib/supabase/server";

interface DashboardStats {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalRevenue: number;
  currency: string;
  isConfigured: boolean;
}

interface RecentTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  customer_name: string | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Default empty stats
  let stats: DashboardStats = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalRevenue: 0,
    currency: "XOF",
    isConfigured: false,
  };

  let recentTransactions: RecentTransaction[] = [];
  let error: string | null = null;

  try {
    // Get merchant-specific dashboard stats
    const { data: statsData, error: statsError } = await supabaseAdmin.rpc(
      "get_shopify_dashboard_stats",
      { p_shop: shop },
    );

    if (statsError) {
      console.error("Error fetching dashboard stats:", statsError);
      error = "Could not load dashboard statistics";
    } else if (statsData && statsData.length > 0) {
      const row = statsData[0];
      stats = {
        totalTransactions: Number(row.total_transactions) || 0,
        successfulTransactions: Number(row.successful_transactions) || 0,
        failedTransactions: Number(row.failed_transactions) || 0,
        totalRevenue: Number(row.total_revenue) || 0,
        currency: row.currency || "XOF",
        isConfigured: Boolean(row.is_configured),
      };
    }

    // Get recent transactions (only if configured)
    if (stats.isConfigured) {
      const { data: txData, error: txError } = await supabaseAdmin.rpc(
        "get_shopify_recent_transactions",
        { p_shop: shop, p_limit: 5 },
      );

      if (txError) {
        console.warn("Error fetching recent transactions:", txError);
      } else if (txData) {
        recentTransactions = txData.map(
          (tx: {
            transaction_id: string;
            amount: number;
            currency: string;
            status: string;
            created_at: string;
            customer_name: string | null;
          }) => ({
            id: tx.transaction_id,
            amount: Number(tx.amount) || 0,
            currency: tx.currency || "XOF",
            status: tx.status || "unknown",
            created_at: tx.created_at,
            customer_name: tx.customer_name,
          }),
        );
      }
    }
  } catch (err) {
    console.error("Dashboard loader error:", err);
    error = "Failed to load dashboard data";
  }

  return {
    shop,
    stats,
    recentTransactions,
    error,
  };
};

export default function Index() {
  const { stats, recentTransactions, error } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  // Currency formatter
  const formatCurrency = (amount: number, currency = "XOF") => {
    if (currency === "XOF") {
      return `${new Intl.NumberFormat("fr-FR").format(amount)} F CFA`;
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  // Calculate success rate
  const successRate =
    stats.totalTransactions > 0
      ? Math.round(
          (stats.successfulTransactions / stats.totalTransactions) * 100,
        )
      : 0;

  if (isLoading) {
    return (
      <SkeletonPage primaryAction>
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={2} />
            </Card>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page title="" fullWidth>
      <ui-title-bar title="Dashboard" />
      <BlockStack gap="500">
        {error && (
          <Banner tone="warning">
            <p>{error}</p>
          </Banner>
        )}

        {/* API Key Setup Prompt - Show if not configured */}
        {!stats.isConfigured && (
          <CalloutCard
            title="Connect your lomi. account"
            illustration="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            primaryAction={{
              content: "Configure API Keys",
              url: "/app/settings",
            }}
          >
            <p>
              To accept payments from the cart with lomi., connect your account
              in Settings, then add the &ldquo;Pay with lomi.&rdquo; block to
              your cart template in the theme editor.
            </p>
          </CalloutCard>
        )}

        {/* Welcome Section */}
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingLg">
              Welcome back
            </Text>
            <Text as="p" tone="subdued">
              Monitor your payments, manage settings, and grow your business
              with a payment solution adapted to Africa.
            </Text>
          </BlockStack>
        </Card>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Total revenue
              </Text>
              <Text as="p" variant="headingXl">
                {formatCurrency(stats.totalRevenue, stats.currency)}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                All completed transactions
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Transactions
              </Text>
              <Text as="p" variant="headingXl">
                {stats.totalTransactions}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {stats.successfulTransactions} successful
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Success rate
              </Text>
              <Text
                as="p"
                variant="headingXl"
                tone={
                  successRate >= 80
                    ? "success"
                    : successRate >= 50
                      ? "caution"
                      : "critical"
                }
              >
                {successRate}%
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Payment success rate
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Failed
              </Text>
              <Text as="p" variant="headingXl" tone="critical">
                {stats.failedTransactions}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Failed transactions
              </Text>
            </BlockStack>
          </Card>
        </div>

        {/* Main Content */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Recent activity
                </Text>
                <Text as="p" tone="subdued">
                  Your recent transactions from lomi. cart payments.
                </Text>

                {recentTransactions.length > 0 ? (
                  <BlockStack gap="300">
                    {recentTransactions.map((tx) => (
                      <InlineStack key={tx.id} align="space-between">
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyMd">
                            {tx.customer_name || tx.id.slice(0, 8) + "..."}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </Text>
                        </BlockStack>
                        <BlockStack gap="050" align="end">
                          <Text
                            as="span"
                            variant="bodyMd"
                            fontWeight="semibold"
                          >
                            {formatCurrency(tx.amount, tx.currency)}
                          </Text>
                          <Text
                            as="span"
                            variant="bodySm"
                            tone={
                              tx.status === "completed"
                                ? "success"
                                : tx.status === "failed"
                                  ? "critical"
                                  : "subdued"
                            }
                          >
                            {tx.status}
                          </Text>
                        </BlockStack>
                      </InlineStack>
                    ))}
                  </BlockStack>
                ) : (
                  <EmptyState
                    heading={
                      stats.isConfigured
                        ? "No transactions yet"
                        : "Connect your account"
                    }
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      {stats.isConfigured
                        ? "Transactions processed via lomi. will appear here."
                        : "Configure your API keys in Settings to see your transactions."}
                    </p>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Quick actions
                </Text>
                <Text as="p" tone="subdued">
                  Manage your store integration
                </Text>
                <BlockStack gap="300">
                  <Link to="/app/settings">
                    <Button
                      fullWidth
                      variant={stats.isConfigured ? "secondary" : "primary"}
                    >
                      {stats.isConfigured
                        ? "Manage access tokens"
                        : "Configure access tokens"}
                    </Button>
                  </Link>
                  <Button
                    url="https://docs.lomi.africa"
                    external
                    fullWidth
                    variant="plain"
                  >
                    Documentation
                  </Button>
                  <Button
                    url="mailto:hello@lomi.africa"
                    external
                    fullWidth
                    variant="plain"
                  >
                    Support
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
