import {
  reactExtension,
  Banner,
  BlockStack,
  Button,
  Image,
  InlineLayout,
  TextBlock,
  useApi,
  useSettings,
  useExtensionCapability,
  useCartLines,
  useShop,
  View,
  Text,
  Divider,
  Tag,
  Icon,
  Spinner,
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
  const shop = useShop();
  const canMakeNetworkRequests = useExtensionCapability("network_access");

  // Calculate total amount
  const totalAmount = cartLines.reduce((total, line) => {
    return total + (line.cost.totalAmount.amount * line.quantity);
  }, 0);

  // Get currency from the first cart line since it's consistent across the cart
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
        Please configure your lomi. API key and merchant ID in the app settings.
      </Banner>
    );
  }

  async function handlePaymentInitiation() {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: undefined }));

      // Get checkout details
      const checkoutToken = await api.sessionToken.get();
      const buyerIdentity = api.buyerIdentity;

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
          customer_email: buyerIdentity.email,
          shop_name: shop.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to initialize payment");
      }

      const { payment_url } = await response.json() as LomiPaymentResponse;
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
      <View border="base" cornerRadius="base" padding="base">
        <BlockStack spacing="tight">
          {/* Header */}
          <InlineLayout spacing="base" columns={["auto", "fill", "auto"]} blockAlignment="center">
            <Image
              source="https://lomi.africa/icon-L.webp"
              accessibilityRole="decorative"
              aspectRatio={1}
              border="base"
              cornerRadius="base"
            />
            <BlockStack spacing="extraTight">
              <Text size="large" emphasis="bold">Pay with lomi.</Text>
              <Text appearance="subdued" size="small">Fast and secure payment</Text>
            </BlockStack>
            <Tag>Recommended</Tag>
          </InlineLayout>

          <Divider />

          {/* Payment Details */}
          <BlockStack spacing="base">
            <InlineLayout columns={["fill", "auto"]} spacing="base" blockAlignment="center" padding="base">
              <Text>Amount to pay</Text>
              <Text emphasis="bold" size="large">
                {totalAmount.toFixed(2)} {currencyCode}
              </Text>
            </InlineLayout>

            {/* Features */}
            <View padding="base" cornerRadius="base">
              <BlockStack spacing="tight">
                <InlineLayout spacing="base" blockAlignment="center">
                  <Icon source="checkmark" appearance="success" />
                  <Text emphasis="bold">Instant payment confirmation</Text>
                </InlineLayout>
                <InlineLayout spacing="base" blockAlignment="center">
                  <Icon source="lock" appearance="info" />
                  <Text emphasis="bold">Secure and encrypted transaction</Text>
                </InlineLayout>
                <InlineLayout spacing="base" blockAlignment="center">
                  <Icon source="mobile" appearance="info" />
                  <Text emphasis="bold">Mobile-friendly experience</Text>
                </InlineLayout>
              </BlockStack>
            </View>
          </BlockStack>

          {/* Error Message */}
          {state.error && (
            <Banner status="critical">
              <TextBlock>{state.error}</TextBlock>
            </Banner>
          )}

          {/* Pay Button */}
          <View padding="base">
            <Button
              onPress={handlePaymentInitiation}
              disabled={state.isLoading}
              kind="primary"
              appearance="monochrome"
            >
              {state.isLoading ? (
                <InlineLayout spacing="tight" blockAlignment="center">
                  <Spinner size="small" appearance="accent" />
                  <Text emphasis="bold">Processing...</Text>
                </InlineLayout>
              ) : (
                <Text emphasis="bold" size="medium">Pay with lomi.</Text>
              )}
            </Button>
          </View>
        </BlockStack>
      </View>
    </BlockStack>
  );
}
