# lomi. Express Checkout: Process & Logic

## 1. How a Shopify User Enables lomi. Express Checkout

The process for a merchant is straightforward:

1.  **Install the App**: The merchant installs the `lomi-shopify` app on their store.
2.  **Configure Credentials**: In the App Dashboard -> Settings:
    - Enter **lomi. API Key**.
    - Enter **lomi. Webhook Secret** (copy from lomi. Dashboard > Webhooks).
    - This is required for us to verify payment notifications securely.
3.  **Add to Checkout**:
    - They go to **Shopify Settings > Checkout > Customize**.
    - They click "Add App Block" and select **lomi. Checkout**.
    - They place the "Pay with lomi." button where they want.
4.  **Save**: Once saved, the button appears for customers.

## 2. Payment Logic & Flow

Here is how the payment flows technically:

1.  **Initiation**: Customer clicks "Pay with lomi.". The extension calls `/api/create-checkout`.
2.  **Creation**: The backend calls Lomi API `v1/checkout-sessions` with metadata: `{ shopify_shop: "store.myshopify.com" }`.
3.  **Payment**: The customer completes payment on Lomi.
4.  **Completion**:
    - Lomi API sends a `PAYMENT_SUCCEEDED` webhook to the Shopify App (`/api/webhooks/lomi/payment-success`).
    - The App verifies the signature using the stored Secret.
    - The App creates a **Draft Order** in Shopify for the amount.
    - The App marks it as **Paid** and converts it to a standard **Order**.
    - The merchant sees a new paid order in their Shopify Admin.

## 3. Product Handling

- **Recommendation**: **Direct Checkout Session (Ad-hoc)**.
- **How it works**: We send a "Custom" checkout session with just the total amount. We do not pass `product_id`.
