import {
  reactExtension,
  Banner,
  BlockStack,
  Button,
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
  PaymentIcon,
  Progress,
  Pressable,
  Image,
} from "@shopify/ui-extensions-react/checkout";
import { useState } from "react";

// Types for our component state and API response
interface PaymentState {
  isLoading: boolean;
  error: string | undefined;
  progress: number;
  selectedMethod: string | null;
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
    progress: 0,
    selectedMethod: null,
  });

  const api = useApi();
  const settings = useSettings();
  const cartLines = useCartLines();
  const shop = useShop();
  const canMakeNetworkRequests = useExtensionCapability("network_access");

  // Calculate total amount
  const totalAmount = cartLines.reduce((total: number, line: { cost: { totalAmount: { amount: number } }, quantity: number }) => {
    return total + (line.cost.totalAmount.amount * line.quantity);
  }, 0);

  // Get currency from the first cart line since it's consistent across the cart
  const currencyCode = cartLines[0]?.cost.totalAmount.currencyCode || "USD";

  if (!canMakeNetworkRequests) {
    return (
      <Banner status="critical" title="Network Access Required">
        <TextBlock>This extension requires network access capabilities.</TextBlock>
      </Banner>
    );
  }

  if (!settings.api_key || !settings.merchant_id) {
    return (
      <Banner status="critical" title="Configuration Required">
        <TextBlock>Please configure your lomi. API key and merchant ID in the app settings.</TextBlock>
      </Banner>
    );
  }

  async function handlePaymentInitiation(method: string = state.selectedMethod || 'WAVE') {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: undefined,
        progress: 25,
        selectedMethod: method,
      }));

      const checkoutToken = await api.sessionToken.get();
      setState(prev => ({ ...prev, progress: 50 }));

      const buyerIdentity = api.buyerIdentity;
      setState(prev => ({ ...prev, progress: 75 }));

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
          customer_email: buyerIdentity?.email || "",
          shop_name: shop.name,
          payment_method: method,
        }),
      });

      setState(prev => ({ ...prev, progress: 90 }));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to initialize payment");
      }

      const { payment_url } = await response.json() as LomiPaymentResponse;
      setState(prev => ({ ...prev, progress: 100 }));
      globalThis.location?.assign(payment_url);

    } catch (err) {
      const error = err instanceof Error ? err : new Error("Something went wrong. Please try again.");
      setState(prev => ({
        ...prev,
        error: error.message,
        progress: 0,
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }

  const paymentMethods = [
    { id: 'WAVE', name: 'Wave', icon: 'wave' },
    { id: 'ORANGE', name: 'Orange Money', icon: 'orange-money' },
    { id: 'MTN', name: 'MTN Money', icon: 'mtn-mobile-money' },
  ];

  return (
    <BlockStack spacing="loose">
      <View border="base" cornerRadius="base" padding="base">
        <BlockStack spacing="tight">
          <InlineLayout spacing="base" columns={["auto", "fill", "auto"]} blockAlignment="center">
            <Image source="https://lomi.africa/icon-L.webp" aspectRatio={1} border="base" cornerRadius="base" />
            <BlockStack spacing="extraTight">
              <Text size="large" emphasis="bold">Pay with lomi.</Text>
              <Text appearance="subdued" size="small">Fast and secure payment</Text>
            </BlockStack>
            <Tag>Recommended</Tag>
          </InlineLayout>

          <Divider />

          <BlockStack spacing="base">
            <Text size="medium" emphasis="bold">Choose payment method</Text>
            <InlineLayout spacing="base" columns={["fill", "fill", "fill"]} blockAlignment="center">
              {paymentMethods.map((method) => (
                <Pressable
                  key={method.id}
                  onPress={() => handlePaymentInitiation(method.id)}
                  disabled={state.isLoading}
                >
                  <View
                    border="base"
                    padding="base"
                    cornerRadius="base"
                  >
                    <BlockStack spacing="tight" inlineAlignment="center">
                      <PaymentIcon name={method.icon} accessibilityLabel={`${method.name} payment`} />
                      <Text size="small">{method.name}</Text>
                    </BlockStack>
                  </View>
                </Pressable>
              ))}
            </InlineLayout>
          </BlockStack>

          <BlockStack spacing="base">
            <InlineLayout columns={["fill", "auto"]} spacing="base" blockAlignment="center" padding="base">
              <Text>Amount to pay</Text>
              <Text emphasis="bold" size="large">
                {totalAmount.toFixed(2)} {currencyCode}
              </Text>
            </InlineLayout>

            {state.isLoading && (
              <Progress
                value={state.progress}
                accessibilityLabel="Payment progress"
              />
            )}
          </BlockStack>

          <View padding="base" cornerRadius="base" border="base">
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

          {state.error && (
            <Banner status="critical" title="Payment Error">
              <TextBlock>{state.error}</TextBlock>
            </Banner>
          )}

          <View padding="base">
            <Pressable onPress={() => handlePaymentInitiation()} disabled={state.isLoading}>
              <Button
                kind="primary"
                appearance="monochrome"
                disabled={state.isLoading}
                inlineAlignment="center"
                onPress={() => handlePaymentInitiation()}
              >
                {state.isLoading ? (
                  <InlineLayout spacing="tight" blockAlignment="center">
                    <Spinner size="small" appearance="accent" />
                    <Text emphasis="bold">Processing...</Text>
                  </InlineLayout>
                ) : (
                  <Text emphasis="bold" size="medium">
                    Pay with {state.selectedMethod ? paymentMethods.find(m => m.id === state.selectedMethod)?.name : 'lomi.'}
                  </Text>
                )}
              </Button>
            </Pressable>
          </View>
        </BlockStack>
      </View>
    </BlockStack>
  );
}
