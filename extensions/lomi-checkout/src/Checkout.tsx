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
  useEmail,
  usePhone,
  useShippingAddress,
} from "@shopify/ui-extensions-react/checkout";
import { useState, useEffect, useCallback } from "react";

export default reactExtension(
  "purchase.checkout.payment-method-list.render-before",
  () => <Extension />,
);

function Extension() {
  const { myshopifyDomain } = useShop();
  const { get: getSessionToken } = useSessionToken();
  const cartLines = useCartLines();
  const totalAmount = useTotalAmount();

  // Get buyer identity if available
  const email = useEmail();
  const phone = usePhone();
  const shippingAddress = useShippingAddress();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // Create checkout session immediately when component mounts
  const createCheckout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await getSessionToken();

      const directApiUrl = "https://connect.lomi.africa/api/direct-checkout";

      // Build customer data from available buyer identity
      const customerData: {
        customerEmail?: string;
        customerName?: string;
        customerPhone?: string;
      } = {};

      if (email) {
        customerData.customerEmail = email;
      }
      if (phone) {
        customerData.customerPhone = phone;
      }
      if (shippingAddress?.firstName || shippingAddress?.lastName) {
        customerData.customerName = [
          shippingAddress?.firstName,
          shippingAddress?.lastName,
        ]
          .filter(Boolean)
          .join(" ");
      }

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
          ...customerData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate checkout");
      }

      const data = await response.json();
      const url = data.checkout_url || data.url;

      if (url) {
        console.log("lomi. checkout ready:", url);
        setCheckoutUrl(url);
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load lomi. checkout. Tap to retry.");
    } finally {
      setLoading(false);
    }
  }, [myshopifyDomain, cartLines, totalAmount, getSessionToken, email, phone, shippingAddress]);

  // Create checkout session on mount
  useEffect(() => {
    if (totalAmount?.amount) {
      createCheckout();
    }
  }, [totalAmount?.amount, createCheckout]);

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
          <Button kind="secondary" onPress={createCheckout}>
            {error}
          </Button>
        )}

        {!error && checkoutUrl ? (
          <Link to={checkoutUrl} external>
            <Button kind="primary" accessibilityLabel="Pay with lomi.">
              Pay with lomi.
            </Button>
          </Link>
        ) : !error ? (
          <Button
            kind="primary"
            loading={loading}
            disabled
            accessibilityLabel="Loading lomi. checkout"
          >
            Loading...
          </Button>
        ) : null}
      </BlockStack>

      <InlineStack inlineAlignment="center">
        <Text size="small" appearance="subdued">
          — or pay with another method below —
        </Text>
      </InlineStack>
    </BlockStack>
  );
}
