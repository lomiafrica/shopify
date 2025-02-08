import {
  reactExtension,
  Banner,
  BlockStack,
  Button,
  Heading,
  Image,
  InlineLayout,
  TextBlock,
  useApi,
  useSettings,
  useExtensionCapability,
  useCartLines,
} from "@shopify/ui-extensions-react/checkout";
import { useState } from "react";

// Types for our component state and API response
interface PaymentState {
  isLoading: boolean;
  error: string | undefined;
}

interface LomiPaymentResponse {
  payment_url: string;
}

// Extension target
export default reactExtension("purchase.checkout.block.render", () => <LomiPayment />);

function LomiPayment() {
  const [state, setState] = useState<PaymentState>({
    isLoading: false,
    error: undefined,
  });

  const api = useApi();
  const settings = useSettings();
  const cartLines = useCartLines();
  const canMakeNetworkRequests = useExtensionCapability("network_access");

  // Calculate total amount
  const totalAmount = cartLines.reduce((total, line) => {
    return total + (line.cost.totalAmount.amount * line.quantity);
  }, 0);

  const currencyCode = cartLines[0]?.cost.totalAmount.currencyCode || "USD";

  if (!canMakeNetworkRequests) {
    return (
      <Banner status="critical">
        This extension requires network access capabilities.
      </Banner>
    );
  }

  if (!settings.api_key || !settings.merchant_id) {
    return (
      <Banner status="critical">
        Please configure your Lomi API key and merchant ID in the app settings.
      </Banner>
    );
  }

  async function handlePaymentInitiation() {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: undefined }));

      // Get checkout details
      const checkoutToken = await api.sessionToken.get();

      // Initialize payment with Lomi API
      const response = await fetch("https://api.lomi.africa/v1/payments/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.api_key}`,
        },
        body: JSON.stringify({
          merchant_id: settings.merchant_id,
          amount: totalAmount,
          currency: currencyCode,
          checkout_token: checkoutToken,
          redirect_url: globalThis.location?.href || "",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initialize payment");
      }

      const { payment_url } = await response.json() as LomiPaymentResponse;

      // Redirect to Lomi payment page
      globalThis.location?.assign(payment_url);

    } catch (err) {
      const error = err instanceof Error ? err : new Error("Something went wrong. Please try again.");
      setState(prev => ({
        ...prev,
        error: error.message,
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }

  return (
    <BlockStack spacing="loose">
      <Heading level={2}>Pay with Lomi</Heading>
      <InlineLayout spacing="base" columns={["auto", "fill"]}>
        <Image
          source="https://cdn.lomi.africa/images/logo.png"
          accessibilityRole="decorative"
        />
        <BlockStack spacing="none">
          <TextBlock>Fast and secure payment with Lomi</TextBlock>
        </BlockStack>
      </InlineLayout>
      {state.error && (
        <Banner status="critical">{state.error}</Banner>
      )}
      <Button
        onPress={handlePaymentInitiation}
        disabled={state.isLoading}
        loading={state.isLoading}
      >
        {state.isLoading ? "Processing..." : "Pay with Lomi"}
      </Button>
    </BlockStack>
  );
}
