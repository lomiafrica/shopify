import {
  reactExtension,
  BlockStack,
  InlineStack,
  Button,
  Link,
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
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    setCheckoutUrl(null);

    try {
      await getSessionToken();

      const directApiUrl = "https://shopify.lomi.africa/api/direct-checkout";

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
      const url = data.checkout_url || data.url;

      if (url) {
        console.log("Got lomi. checkout URL:", url);
        setCheckoutUrl(url);
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

        {checkoutUrl ? (
          <BlockStack spacing="base">
            <Banner status="success" title="Ready to pay!">
              Click the button below to complete your payment with lomi.
            </Banner>
            <Link to={checkoutUrl} external>
              <Button kind="primary" accessibilityLabel="Complete payment with lomi.">
                Complete payment with lomi.
              </Button>
            </Link>
          </BlockStack>
        ) : (
          <Button
            kind="primary"
            onPress={handlePay}
            loading={loading}
            accessibilityLabel="Pay with lomi."
          >
            Continue with lomi.
          </Button>
        )}
      </BlockStack>

      <InlineStack inlineAlignment="center">
        <Text size="small" appearance="subdued">
          — or pay with another method below —
        </Text>
      </InlineStack>
    </BlockStack>
  );
}
