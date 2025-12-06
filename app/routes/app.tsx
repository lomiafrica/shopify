import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { authenticate } from "../shopify.server";
import { Analytics } from "@vercel/analytics/remix";

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
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      <AppProvider isEmbeddedApp apiKey={apiKey}>
        <ui-nav-menu>
          <Link to="/app" rel="home">
            Dashboard
          </Link>
          <Link to="/app/transactions">Transactions</Link>
          <Link to="/app/support">Support</Link>
          <Link to="/app/settings">Settings</Link>
        </ui-nav-menu>
        <Outlet />
      </AppProvider>
      <Analytics />
    </PolarisAppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      {boundary.error(useRouteError())}
    </PolarisAppProvider>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  const boundaryHeaders = boundary.headers(headersArgs);

  // Add CSP headers for embedded apps
  boundaryHeaders.set(
    "Content-Security-Policy",
    "frame-ancestors https://*.shopify.com https://admin.shopify.com https://*.myshopify.com; default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://admin.shopify.com https://cdn.shopify.com data: blob: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://admin.shopify.com https://cdn.shopify.com;",
  );

  return boundaryHeaders;
};
