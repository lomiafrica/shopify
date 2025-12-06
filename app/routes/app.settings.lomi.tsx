import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useEffect, useState } from "react";
import { Toast } from "@shopify/app-bridge-react";

// Assuming Shadcn UI components are available. Adjust import paths if necessary.
// Trying '~/components/ui/...' as a common Remix alias for 'app/components/ui/...'
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";

// This page POSTs to the existing action at /api/api.validate-lomi-key
// No loader or action is defined in this file itself for that part.

interface ActionData {
  success?: boolean;
  message?: string;
  errors?: { lomiApiKey?: string }; // For specific input validation errors
  lomi_api_key_masked?: string; // Returned on successful validation
}

export default function LomiSettingsPage() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Show Toast when action returns message
  useEffect(() => {
    if (actionData?.message) {
      setToastMessage(actionData.message);
      setIsError(!actionData.success);
    }
  }, [actionData]);

  // Dismiss Toast handler
  const toggleToast = () => {
    setToastMessage(null);
    setIsError(false);
  };

  // Attempt to get the initial masked key from actionData if a submission just happened
  // or potentially from a loader if we decide to load it initially.
  const displayedMaskedKey = actionData?.success
    ? actionData.lomi_api_key_masked
    : null;

  return (
    <div className="p-6 max-w-2xl mx-auto font-sans space-y-8">
      {/* Render Native Shopify Toast */}
      {toastMessage && (
        <Toast
          content={toastMessage}
          error={isError}
          onDismiss={toggleToast}
          duration={4500}
        />
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Configure your payment integration details.
        </p>
      </div>
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <CardTitle>lomi. API Key Configuration</CardTitle>
          <CardDescription>
            Enter your API key to connect your Shopify store to lomi. and
            process orders with a localized payment gateway.
            {displayedMaskedKey && (
              <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                Current key active: {displayedMaskedKey}
              </p>
            )}
          </CardDescription>
        </CardHeader>
        {/* The form posts to the existing API route */}
        <Form method="post" action="/api/api.validate-lomi-key">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="lomiApiKey"
                className="text-xs text-muted-foreground"
              >
                lomi. API Key
              </Label>
              <Input
                id="lomiApiKey"
                name="lomiApiKey"
                type="password"
                placeholder="Enter your Lomi API Key"
                required
                className="rounded-sm" // Adhering to style-guide
                aria-describedby={
                  actionData?.errors?.lomiApiKey
                    ? "lomiApiKey-error"
                    : undefined
                }
              />
              {actionData?.errors?.lomiApiKey && (
                <p
                  id="lomiApiKey-error"
                  className="text-sm text-red-700 dark:text-red-300"
                >
                  {actionData.errors.lomiApiKey}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="lomiWebhookSecret"
                className="text-xs text-muted-foreground"
              >
                lomi. Webhook Secret
              </Label>
              <Input
                id="lomiWebhookSecret"
                name="lomiWebhookSecret"
                type="password"
                placeholder="Enter your Lomi Webhook Secret"
                className="rounded-sm"
              />
              <p className="text-xs text-gray-500">
                Found in your lomi. dashboard under Developers {'>'} Webhooks.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start space-y-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-sm"
            >
              {" "}
              {/* Adhering to style-guide */}
              {isSubmitting ? "Saving..." : "Save and Validate API Key"}
            </Button>
            {/* Inline message removed in favor of Toast */}
          </CardFooter>
        </Form>
      </Card>
    </div>
  );
}
