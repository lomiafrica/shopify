import {
  reactExtension,
  BlockStack,
  InlineStack,
  Button,
  Text,
  useCartLines,
  useTotalAmount,
  useSessionToken,
  useShop,
  Banner,
} from "@shopify/ui-extensions-react/checkout";
import { useState } from "react";

export default reactExtension(
  "purchase.checkout.payment-method-list.render-before",
  () => <Extension />,
);

function Extension() {
  const { myshopifyDomain } = useShop();
  const { get: getSessionToken } = useSessionToken();
  const cartLines = useCartLines();
  const totalAmount = useTotalAmount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      // Note: We don't need the session token for the direct endpoint
      // The shop domain is used instead to look up credentials
      await getSessionToken(); // Still call to ensure valid session

      // Use direct API endpoint (bypasses app proxy to avoid password protection CORS issues)
      // In production, this should use your deployed app URL
      const directApiUrl =
        process.env.NODE_ENV === "development"
          ? "https://shopify.lomi.africa/api/direct-checkout"
          : "https://shopify.lomi.africa/api/direct-checkout";

      console.log("Calling direct checkout API:", directApiUrl);
      console.log("Shop domain:", myshopifyDomain);
      console.log("Total amount:", totalAmount?.amount);

      const response = await fetch(directApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shopDomain: myshopifyDomain,
          lineItems: cartLines,
          totalAmount: totalAmount?.amount,
          currencyCode: totalAmount?.currencyCode,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate checkout");
      }

      const data = await response.json();

      // The lomi API returns checkout_url, not url
      const checkoutUrl = data.checkout_url || data.url;

      if (checkoutUrl) {
        console.log("Redirecting to lomi checkout:", checkoutUrl);
        // Use globalThis.open to redirect - triggered by user button press
        if (typeof globalThis !== "undefined" && globalThis.open) {
          globalThis.open(checkoutUrl, "_top");
        }
      } else {
        console.error("API response:", data);
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to process payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlockStack spacing="tight">
      <BlockStack
        spacing="base"
        padding="base"
        border="base"
        cornerRadius="base"
      >
        <InlineStack spacing="tight" blockAlignment="center">
          <Text size="medium" emphasis="bold">
            Pay with lomi.
          </Text>
          <Text size="small" appearance="subdued">
            Mobile money, cards & more
          </Text>
        </InlineStack>
        {error && (
          <Banner status="critical" title="Payment Failed">
            {error}
          </Banner>
        )}
        <Button
          kind="primary"
          onPress={handlePay}
          loading={loading}
          accessibilityLabel="Pay with lomi."
        >
          Continue with lomi.
        </Button>
      </BlockStack>
      <InlineStack inlineAlignment="center">
        <Text size="small" appearance="subdued">
          — or pay with another method below —
        </Text>
      </InlineStack>
    </BlockStack>
  );
}
