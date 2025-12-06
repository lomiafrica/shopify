import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Don't authenticate on the exit iframe route - this is used to break out of iframes
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");

  // Construct the auth URL manually
  const authUrl = new URL("/auth", url.origin);
  if (shop) authUrl.searchParams.set("shop", shop);
  if (host) authUrl.searchParams.set("host", host);

  return new Response(
    `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0; url=${authUrl.toString()}" />
    <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; frame-ancestors * 'self'; object-src 'none';" />
    <style>
      body {
        margin: 0;
        padding: 20px;
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background: #f6f6f7;
        text-align: center;
      }
      .container {
        max-width: 400px;
      }
      .link {
        color: #006FBB;
        text-decoration: none;
        font-size: 14px;
        margin-top: 10px;
        display: inline-block;
      }
      .link:hover {
        text-decoration: underline;
      }
    </style>
    <script>
      // Immediate redirect to break out of iframe
      if (window.top !== window.self) {
        window.top.location.href = "${authUrl.toString()}";
      } else {
        window.location.href = "${authUrl.toString()}";
      }
    </script>
  </head>
  <body>
    <div class="container">
      <p style="margin: 0; color: #202123;">Redirecting to authentication...</p>
      <p style="margin: 10px 0 0; font-size: 14px; color: #656B7D;">
        <a href="${authUrl.toString()}" class="link" target="_top">
          Click here if you are not redirected automatically
        </a>
      </p>
      <form action="${authUrl.toString()}" method="get" target="_top" style="margin-top: 20px;">
        <input type="hidden" name="shop" value="${shop || ""}" />
        <input type="hidden" name="host" value="${host || ""}" />
        <button type="submit" style="background: #006FBB; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-family: inherit;">
          Continue to Authentication
        </button>
      </form>
    </div>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Frame-Options": "ALLOWALL",
        "Content-Security-Policy":
          "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; frame-ancestors * 'self'; object-src 'none';",
      },
    },
  );
};

export default function AuthExitIframe() {
  // This component should never render because we return a Response directly from the loader
  return null;
}
