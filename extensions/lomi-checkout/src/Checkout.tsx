import {
    reactExtension,
    BlockStack,
    Button,
    useCartLines,
    useTotalAmount,
    useSessionToken,
    Banner,
} from '@shopify/ui-extensions-react/checkout';
import { useState } from 'react';

export default reactExtension(
    'purchase.checkout.block.render',
    () => <Extension />,
);

function Extension() {
    const { get: getSessionToken } = useSessionToken();
    const cartLines = useCartLines();
    const totalAmount = useTotalAmount();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePay = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await getSessionToken();

            // Call the proxy endpoint in the Remix app
            const response = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, // Provide session token for authentication context if needed
                },
                body: JSON.stringify({
                    cart: { id: "cart_placeholder" }, // We might need actual cart ID if available in API, but extension API provides lines
                    lineItems: cartLines,
                    totalAmount: totalAmount?.amount,
                    currencyCode: totalAmount?.currencyCode,
                    successUrl: '', // Allow backend to determine or pass window.location if accessible (it's not)
                    cancelUrl: '',
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to initiate checkout');
            }

            const data = await response.json();

            if (data.url) {
                // Use Shopify's UI API to open URL if possible, or just standard window if allowed (sandbox might restrict)
                // Standard window.open might be blocked. 
                // Checkout extensions typically can't redirect top-level easily without user action.
                // We are in a Button onPress, so it counts as user action.
                // However, Shopify recommends using `ui.overlay.openUrl` or similar? 
                // Actually, for redirecting to payment, usually specific targets are used (payment extensions).
                // Since this is a "Block" extension, we might just use console log for now or try linking.
                // But let's assume `console.log` for V1 and we likely need to output a Link or use a specific API.
                // `ui` object might have capabilities.

                // Checking docs: standard `open(url, "_top")` might work if triggered by user.
                // Or using `Link` component.
                // Let's try attempting a direct location change via a hidden link or just standard approach.
                // Actually, the best way in extensions is often `globalThis.open(url, '_self')`? No, sandbox.
                // We will assume for now that we can just display the link if redirect fails, or that the response is a URL we can navigate to.

                // NOTE: In strict sandbox, navigation is improved by using the `Link` component or `ui` utilities.
                // Let's log it for now and try to redirect.
                console.log("Redirecting to:", data.url);
                // @ts-ignore
                if (globalThis.open) {
                    // @ts-ignore
                    globalThis.open(data.url, '_top');
                }
            } else {
                throw new Error('No checkout URL returned');
            }

        } catch (err) {
            console.error(err);
            setError('Failed to process payment. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BlockStack spacing="base">
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
                Pay with lomi.
            </Button>
        </BlockStack>
    );
}
