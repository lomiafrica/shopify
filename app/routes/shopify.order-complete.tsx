import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import shopify from "../shopify.server";
import { getDraftOrderStatus } from "@/app/lib/shopify/draft-order.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const draft = url.searchParams.get("draft");

  if (!shop || !draft) {
    return json({
      shop: null,
      draftOrderId: null,
      orderName: null,
      draftName: null,
      completed: false,
      error: "Missing shop or order reference",
    });
  }

  const offlineSessionId = `offline_${shop.replace(/^https?:\/\//, "")}`;
  const session = await shopify.sessionStorage.loadSession(offlineSessionId);

  if (!session) {
    return json({
      shop,
      draftOrderId: draft,
      orderName: null,
      draftName: null,
      completed: false,
      error: null,
    });
  }

  try {
    const status = await getDraftOrderStatus(session, draft);
    return json({
      shop,
      draftOrderId: draft,
      orderName: status.orderName,
      draftName: status.name,
      completed: status.completed,
      error: null,
    });
  } catch (error) {
    console.error("[order-complete] Error loading draft order:", error);
    return json({
      shop,
      draftOrderId: draft,
      orderName: null,
      draftName: null,
      completed: false,
      error: null,
    });
  }
}

export default function OrderCompletePage() {
  const data = useLoaderData<typeof loader>();
  const shopHost = data.shop?.replace(/^https?:\/\//, "") ?? "";
  const storeUrl = shopHost ? `https://${shopHost}` : "/";
  const displayOrder = data.orderName || data.draftName;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Payment successful — lomi.</title>
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
            text-align: center;
          }
          h1 { font-size: 1.5rem; margin: 0 0 8px; }
          p { color: #555; margin: 0 0 16px; line-height: 1.5; }
          .order-ref { font-weight: 600; color: #111; }
          a.button {
            display: inline-block;
            margin-top: 8px;
            padding: 12px 24px;
            background: #111;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
          }
          .pending { color: #856404; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <h1>Payment successful</h1>
          {displayOrder ? (
            <p>
              Thank you! Your order{" "}
              <span className="order-ref">{displayOrder}</span> is confirmed.
            </p>
          ) : data.completed === false ? (
            <p className="pending">
              Payment received. Your order is being confirmed — you can return
              to the store shortly.
            </p>
          ) : (
            <p>Thank you! Your payment was successful.</p>
          )}
          <p>Powered by lomi.</p>
          <a className="button" href={storeUrl}>
            Return to store
          </a>
        </div>
        {shopHost ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    fetch('https://${shopHost}/cart/clear.js', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' }
                    }).catch(function() {});
                  } catch (e) {}
                })();
              `,
            }}
          />
        ) : null}
      </body>
    </html>
  );
}
