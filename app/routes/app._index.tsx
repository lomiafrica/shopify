import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link as RemixLink, useNavigation } from "@remix-run/react";
import pkg from "@shopify/app-bridge-react";
import {
  SkeletonPage,
  Layout,
  LegacyCard,
  SkeletonBodyText,
  SkeletonDisplayText,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import {
  Activity,
  CreditCard,
  Settings,
  HelpCircle,
  TrendingUp,
  AlertCircle,
  ExternalLink
} from "lucide-react";

// @ts-ignore
const { TitleBar } = pkg;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // TODO: Fetch actual stats from your backend
  return {
    stats: {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalAmount: 0, // Changed to number for formatting
      currency: 'XOF'
    },
    recentTransactions: [],
  };
};

export default function Index() {
  const { stats } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  // Explicit Currency Formatting (e.g. "150 000 F CFA")
  const formatCurrency = (amount: number, currency = 'XOF') => {
    // Replicate logic from apps/dashboard/src/lib/utils/format.ts
    const locale = 'fr-FR'; // fr-FR uses space for thousands
    const normalizedCurrency = currency === 'XOF' ? 'F CFA' : currency;

    if (currency === 'XOF') {
      const formattedNumber = new Intl.NumberFormat(locale, {
        style: 'decimal',
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(amount).replace(/\s/g, " "); // Ensure regular spaces
      return `${formattedNumber} ${normalizedCurrency}`;
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <SkeletonPage primaryAction>
        <Layout>
          <Layout.Section>
            <LegacyCard sectioned>
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={2} />
            </LegacyCard>
            <LegacyCard sectioned>
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={2} />
            </LegacyCard>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans">
      <TitleBar title="Dashboard" />

      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Welcome back to lomi.
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl text-lg">
          Monitor your payments, manage settings, and grow your business with localized payment solutions.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount, stats.currency)}</div>
            <p className="text-xs text-muted-foreground">
              +20.1% from last month
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransactions}</div>
            <p className="text-xs text-muted-foreground">
              +180 since last hour
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.totalTransactions > 0
                ? Math.round((stats.successfulTransactions / stats.totalTransactions) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.successfulTransactions} successful payments
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failedTransactions}</div>
            <p className="text-xs text-muted-foreground">
              Action required on 2 items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-6 md:grid-cols-7">

        {/* Recent Activity (Placeholder for now) */}
        <Card className="md:col-span-4 rounded-xl border shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your recent transactions from Shopify checkout.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed">
              <Activity className="h-8 w-8 text-gray-400" />
              <div className="space-y-1">
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">No transactions yet</p>
                <p className="text-sm text-gray-500">
                  Transactions processed via lomi. will appear here.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="md:col-span-3 space-y-6">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your store integration</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <RemixLink to="/app/settings" className="w-full">
                <Button variant="outline" className="w-full justify-start gap-2 h-12 text-md">
                  <Settings className="h-4 w-4" />
                  Configure API Keys
                </Button>
              </RemixLink>
              <a href="https://docs.lomi.africa" target="_blank" rel="noreferrer" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-2 h-10 text-muted-foreground hover:text-primary">
                  <ExternalLink className="h-4 w-4" />
                  Read Documentation
                </Button>
              </a>
              <a href="mailto:support@lomi.africa" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-2 h-10 text-muted-foreground hover:text-primary">
                  <HelpCircle className="h-4 w-4" />
                  Contact Support
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
