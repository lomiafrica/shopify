import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Get the session token from Shopify
    const { session } = await authenticate.admin(request);

    if (!session) {
      return new Response("No session found", { status: 401 });
    }

    // Return success with proper headers for embedded apps
    return new Response(
      JSON.stringify({
        success: true,
        shop: session.shop,
        status: "authenticated"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Security-Policy": "frame-ancestors https://*.shopify.com https://admin.shopify.com https://shopify.com https://*.myshopify.com; default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://admin.shopify.com https://cdn.shopify.com data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://admin.shopify.com https://cdn.shopify.com;",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (error) {
    console.error("Session token error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Authentication failed"
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Content-Security-Policy": "frame-ancestors https://*.shopify.com https://admin.shopify.com https://shopify.com https://*.myshopify.com; default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://admin.shopify.com https://cdn.shopify.com data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://admin.shopify.com https://cdn.shopify.com;",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  }
};

// Handle both GET and POST for session token requests
export const action = loader;
