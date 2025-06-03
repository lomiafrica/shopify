import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider, Frame, Navigation } from "@shopify/polaris";
import appBridgePkg from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { authenticate } from "../shopify.server";
import { Analytics } from "@vercel/analytics/remix"

const { Provider: AppBridgeProvider } = appBridgePkg;

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    host: url.searchParams.get("host") || "",
  };
};

export default function App() {
  const { apiKey, host } = useLoaderData<typeof loader>();

  const navigationMarkup = (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {
            url: "/app",
            label: "Dashboard",
            exactMatch: true,
          },
          {
            url: "/app/transactions",
            label: "Transactions",
          },
          {
            url: "/app/support",
            label: "Support",
          },
          {
            url: "/app/settings",
            label: "Settings",
          },
        ]}
      />
    </Navigation>
  );

  // App Bridge configuration
  const appBridgeConfig = {
    apiKey,
    host,
    forceRedirect: true,
  };

  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      <AppBridgeProvider config={appBridgeConfig}>
        <AppProvider isEmbeddedApp apiKey={apiKey}>
          <Frame navigation={navigationMarkup}>
            <Outlet />
          </Frame>
        </AppProvider>
      </AppBridgeProvider>
      <Analytics />
    </PolarisAppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  const boundaryHeaders = boundary.headers(headersArgs);

  // Add CSP headers for embedded apps
  boundaryHeaders.set(
    "Content-Security-Policy",
    "frame-ancestors https://*.shopify.com https://admin.shopify.com https://*.myshopify.com; default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://admin.shopify.com https://cdn.shopify.com data: blob: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://admin.shopify.com https://cdn.shopify.com;"
  );

  return boundaryHeaders;
};
