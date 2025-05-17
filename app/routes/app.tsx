import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { Frame, Navigation } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_CLIENT_ID || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

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

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <Frame navigation={navigationMarkup}>
        <Outlet />
      </Frame>
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
