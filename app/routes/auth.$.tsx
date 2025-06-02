import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    console.log("Auth route accessed:", url.pathname, url.search);

    const result = await authenticate.admin(request);
    console.log("Authentication successful for:", result.session.shop);

    return null;
  } catch (error) {
    console.error("Authentication failed in auth.$ route:", error);

    // Let Shopify handle the authentication error
    throw error;
  }
};
