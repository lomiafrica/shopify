import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { Button, Card, Page, Text, Banner } from "@shopify/polaris";
import { SupabaseSessionStorage } from "@/app/lib/session-storage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const shop = url.searchParams.get("shop");

  return {
    error,
    shop: shop || "lomi-test-build.myshopify.com",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const shop = formData.get("shop") as string;

  if (shop) {
    const sessionStorage = new SupabaseSessionStorage();

    // Delete all sessions for this shop
    const existingSessions = await sessionStorage.findSessionsByShop(shop);
    if (existingSessions.length > 0) {
      const sessionIds = existingSessions.map((session) => session.id);
      await sessionStorage.deleteSessions(sessionIds);
      console.log(
        `[AuthReset] Deleted ${sessionIds.length} sessions for shop: ${shop}`,
      );
    }

    // Redirect to login to start fresh OAuth flow
    return redirect(`/auth/login?shop=${encodeURIComponent(shop)}`);
  }

  return redirect("/auth/login");
};

export default function AuthReset() {
  const { error, shop } = useLoaderData<typeof loader>();

  return (
    <Page title="Reset Authentication">
      <Card>
        <div style={{ padding: "20px" }}>
          {error && (
            <div style={{ marginBottom: "20px" }}>
              <Banner title="Authentication Error" tone="critical">
                <Text as="p">
                  {error === "callback_failed"
                    ? "OAuth callback failed. This is likely due to cookie handling issues on Vercel."
                    : `Error: ${error}`}
                </Text>
              </Banner>
            </div>
          )}

          <Text variant="headingMd" as="h2">
            Reset App Authentication
          </Text>
          <br />
          <Text as="p">
            This will clear all stored sessions and restart the OAuth flow. Use
            this if you're experiencing authentication issues.
          </Text>

          {error === "callback_failed" && (
            <>
              <br />
              <Text as="p" tone="subdued">
                <strong>Troubleshooting:</strong> The authentication callback
                failed, which is common on Vercel due to cookie handling
                differences. Clearing sessions and restarting should resolve
                this.
              </Text>
            </>
          )}

          <br />
          <Form method="post">
            <input type="hidden" name="shop" value={shop} />
            <Button submit>Clear Sessions & Restart OAuth</Button>
          </Form>
        </div>
      </Card>
    </Page>
  );
}
