import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log("Auth callback route accessed");
    const url = new URL(request.url);
    console.log("Callback URL:", url.toString());
    console.log(
      "Callback headers:",
      Object.fromEntries(request.headers.entries()),
    );

    const result = await authenticate.admin(request);
    console.log("Authentication successful in callback:", result.session.shop);

    // Redirect to the main app after successful authentication
    const appUrl = new URL("/app", url.origin);
    appUrl.searchParams.set("shop", result.session.shop);

    if (url.searchParams.get("host")) {
      appUrl.searchParams.set("host", url.searchParams.get("host")!);
    }

    console.log("Redirecting to:", appUrl.toString());

    return new Response(null, {
      status: 302,
      headers: {
        Location: appUrl.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    // If the error is a Response, it's a redirect thrown by the Shopify library or Remix
    // We should throw it so Remix can handle the redirect
    if (error instanceof Response) {
      throw error;
    }

    console.error("Authentication callback error:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      requestUrl: request.url,
      requestHeaders: Object.fromEntries(request.headers.entries()),
    });

    // For debugging purposes, let's see what the actual error is
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (shop) {
      // Try to redirect to the auth reset page for debugging
      const resetUrl = new URL("/auth/reset", url.origin);
      resetUrl.searchParams.set("shop", shop);
      resetUrl.searchParams.set("error", "callback_failed");

      return new Response(null, {
        status: 302,
        headers: {
          Location: resetUrl.toString(),
        },
      });
    }

    throw error;
  }
};
