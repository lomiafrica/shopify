import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../shopify.server";

function normalizeShopDomain(shop: string | null): string | null {
  if (!shop) return null;

  const trimmed = shop
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (!trimmed) return null;

  if (trimmed.includes(".")) {
    if (!trimmed.endsWith(".myshopify.com")) {
      return null;
    }
    return trimmed;
  }

  return `${trimmed}.myshopify.com`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = normalizeShopDomain(url.searchParams.get("shop"));

  if (shop) {
    const loginUrl = new URL(url);
    loginUrl.searchParams.set("shop", shop);
    throw await login(new Request(loginUrl.toString(), request));
  }

  return json({
    error: url.searchParams.get("error"),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const shop = normalizeShopDomain(formData.get("shop")?.toString() ?? null);

  if (!shop) {
    return redirect("/install?error=invalid_shop");
  }

  const loginUrl = new URL(request.url);
  loginUrl.searchParams.set("shop", shop);
  throw await login(new Request(loginUrl.toString(), request));
}

export default function InstallPage() {
  const { error } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Install lomi. on Shopify</title>
        <style>{`
          * { box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f6f8fa;
            color: #1a1a1a;
            padding: 24px;
          }
          .card {
            background: #fff;
            border-radius: 12px;
            padding: 32px;
            max-width: 420px;
            width: 100%;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          }
          h1 { font-size: 1.5rem; margin: 0 0 8px; }
          p { color: #555; margin: 0 0 16px; line-height: 1.5; }
          label { display: block; font-weight: 500; margin-bottom: 8px; }
          input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ccc;
            border-radius: 8px;
            font-size: 1rem;
            margin-bottom: 8px;
          }
          button {
            width: 100%;
            padding: 12px;
            background: #111;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
          }
          .error { color: #b42318; font-size: 0.875rem; margin-bottom: 12px; }
          .hint { font-size: 0.875rem; color: #666; margin-bottom: 16px; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <h1>Install lomi. on Shopify</h1>
          <p>
            Enter your store domain to authorize the lomi. app. After install,
            open Settings in the app to connect your lomi. API keys.
          </p>
          {error ? (
            <p className="error">
              Please enter a valid Shopify domain (e.g. my-store.myshopify.com).
            </p>
          ) : null}
          <Form method="post">
            <label htmlFor="shop">Store domain</label>
            <input
              id="shop"
              name="shop"
              type="text"
              placeholder="my-store.myshopify.com"
              autoComplete="off"
              required
            />
            <p className="hint">
              You can also use just the store handle (e.g. my-store).
            </p>
            <button type="submit">Continue to Shopify</button>
          </Form>
        </div>
      </body>
    </html>
  );
}
