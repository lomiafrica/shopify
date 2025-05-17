# Lomi Webhooks Documentation

Webhooks allow your application to receive real-time notifications about events happening within your Lomi account, such as successful payments, new subscriptions, or failed transactions. Instead of constantly polling the Lomi API for changes, you can configure Lomi to send HTTP POST requests to an endpoint you control whenever specific events occur.

## Why Use Webhooks?

- **Real-time Updates:** Get notified instantly about important events.
- **Automation:** Trigger actions in your systems automatically (e.g., update customer records, provision services, send confirmation emails, update accounting software).
- **Efficiency:** Avoid unnecessary API polling, saving resources.
- **Improved Reliability:** Respond promptly to events like failed payments.

## Available Webhook Events

You can subscribe to notifications for the following events:

- `PAYMENT_CREATED`: A new payment attempt has been initiated.
- `PAYMENT_SUCCEEDED`: A payment was successfully completed.
- `PAYMENT_FAILED`: A payment attempt failed.
- `REFUND_CREATED`: A refund process has been initiated.
- `REFUND_COMPLETED`: A refund was successfully processed.
- `SUBSCRIPTION_CREATED`: A new subscription has been created.
- `SUBSCRIPTION_RENEWED`: A subscription has successfully renewed.
- `SUBSCRIPTION_CANCELED`: A subscription has been canceled.
- `CHECKOUT_COMPLETED`: A Lomi Checkout session was successfully completed (payment succeeded).
- `PROVIDER_STATUS_CHANGED`: A status change related to a provider occurred (less common, often related to underlying provider updates).

## 1. Setting Up Your Webhook Endpoint

Before configuring a webhook in Lomi, you need to create an endpoint (a URL) on your server that:

1.  Is **publicly accessible** over HTTPS.
2.  Can receive **HTTP POST requests** with a **JSON payload**.
3.  Is prepared to handle incoming webhook data from Lomi.

For local development and testing, you can use tools like [ngrok](https://ngrok.com/) or [localtunnel](https://theboroer.github.io/localtunnel-www/) to expose your local server to the internet, or use online services like [Webhook.site](https://webhook.site/) or [Beeceptor](https://beeceptor.com/) for temporary endpoints.

## 2. Configuring Webhooks in Lomi

Once your endpoint is ready, configure it in your Lomi Merchant Dashboard (or via the Lomi API):

1.  Navigate to the **Developers -> Webhooks** section in your Lomi Dashboard.
2.  Click "Add Endpoint" or "Create Webhook".
3.  Enter your **Endpoint URL** (the publicly accessible HTTPS URL you prepared).
4.  Select the **Events** you want to subscribe to for this endpoint. You can choose multiple events.
5.  Click "Create Webhook".
6.  **Crucially, copy the generated `Signing Secret`** (it starts with `whsec_`). This secret is unique to this webhook endpoint and is essential for verifying incoming requests. Store it securely on your server; you will need it to verify signatures.

## 3. Receiving Webhooks

When a subscribed event occurs, Lomi will send an HTTP POST request to your configured endpoint URL with the following characteristics:

- **Method:** `POST`
- **Content-Type:** `application/json`
- **Headers:**
  - `X-Lomi-Event`: The type of event that triggered the webhook (e.g., `PAYMENT_SUCCEEDED`).
  - `X-Lomi-Signature`: The unique signature calculated by Lomi for this request. You MUST use this to verify the request's authenticity.
  - `User-Agent`: `Lomi-Webhook/1.0`
- **Body:** A JSON object containing the event details.

### Payload Structure

The JSON payload will have the following structure:

```json
{
  "id": "evt_randomlygenerateduuid", // Unique ID for this webhook event delivery
  "event": "PAYMENT_SUCCEEDED", // The type of event
  "timestamp": "2023-10-27T10:30:00Z", // ISO 8601 timestamp of when the event delivery was created
  "data": {
    // Object containing the resource related to the event
    // Structure varies depending on the event type
    // Example for PAYMENT_SUCCEEDED:
    "transaction_id": "txn_abc123...",
    "merchant_id": "mer_xyz789...",
    "organization_id": "org_123abc...",
    "customer_id": "cus_def456...",
    // ... other transaction details ...
    "status": "completed",
    "gross_amount": 10000,
    "currency_code": "XOF"
  },
  "lomi_environment": "live" // or "test"
}
```

## 4. Verifying Signatures (Security Requirement)

**This is the most critical step.** Verifying the signature ensures that the webhook request genuinely originated from Lomi and wasn't tampered with during transit. **Do not process webhooks without verifying the signature.**

Lomi generates the signature using a Hash-based Message Authentication Code (HMAC) with SHA256.

**Verification Steps:**

1.  **Extract the Signature:** Get the value of the `X-Lomi-Signature` header from the incoming request.
2.  **Get the Raw Payload:** You need the **raw request body** as a string, exactly as it was received, _before_ any JSON parsing or modification. How you access this depends on your web framework (see examples below).
3.  **Prepare the HMAC:** Using your securely stored `Signing Secret` (the `whsec_...` string obtained from Lomi for this endpoint) as the key, compute the HMAC SHA256 hash of the raw request body string.
4.  **Compare:** Compare the hash you computed (in hexadecimal format) with the signature extracted from the header. Use a **timing-safe comparison** function to prevent timing attacks. If they match, the request is valid.

### Code Examples for Signature Verification

Replace `'your-webhook-signing-secret'` with the actual secret for your endpoint.

**Node.js (with Express):**

```javascript
const crypto = require("crypto");
const express = require("express");

// Use express.raw() middleware for the webhook route BEFORE express.json()
// This makes the raw body available on req.rawBody
app.post(
  "/your-webhook-endpoint",
  express.raw({ type: "application/json" }), // Important: Get raw body
  (req, res) => {
    const secret = "your-webhook-signing-secret"; // Store securely!
    const receivedSignature = req.headers["x-lomi-signature"];
    const rawBody = req.rawBody; // Access the raw body buffer/string

    if (!receivedSignature || !rawBody) {
      console.error("Missing signature or body");
      return res.status(400).send("Webhook Error: Missing signature or body");
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody) // Use the raw body
        .digest("hex");

      // Use crypto.timingSafeEqual for security
      const isValid = crypto.timingSafeEqual(
        Buffer.from(receivedSignature),
        Buffer.from(expectedSignature),
      );

      if (!isValid) {
        console.error("Invalid signature");
        return res.status(400).send("Webhook Error: Invalid signature");
      }

      // Signature is valid, process the event
      console.log("Webhook signature verified successfully!");
      const event = JSON.parse(rawBody.toString()); // Now parse the JSON
      // --- Your event processing logic here ---
      // Example: handlePaymentSucceeded(event.data);

      // Acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error verifying webhook:", error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  },
);
```

**Python (with Flask):**

```python
import hmac
import hashlib
import json
from flask import Flask, request, abort

app = Flask(__name__)

@app.route('/your-webhook-endpoint', methods=['POST'])
def webhook_listener():
    secret = b'your-webhook-signing-secret' # Store securely, ensure it's bytes
    received_signature = request.headers.get('X-Lomi-Signature')
    raw_body = request.get_data() # Get raw body as bytes

    if not received_signature:
        print("Missing signature header")
        abort(400)

    try:
        expected_signature = hmac.new(
            secret,
            raw_body, # Use raw body bytes
            hashlib.sha256
        ).hexdigest()

        # Use hmac.compare_digest for security
        if not hmac.compare_digest(received_signature, expected_signature):
            print("Invalid signature")
            abort(400)

        # Signature is valid
        print("Webhook signature verified successfully!")
        event = json.loads(raw_body.decode('utf-8')) # Now parse the JSON

        # --- Your event processing logic here ---
        # Example: handle_payment_succeeded(event['data'])

        return json.dumps({'received': True}), 200

    except Exception as e:
        print(f"Error processing webhook: {e}")
        abort(400)

if __name__ == '__main__':
    app.run(port=5000)
```

_(Add examples for other languages like PHP, Ruby if needed)_

## 5. Responding to Webhooks

Your endpoint MUST respond to the webhook request quickly with an HTTP status code in the `2xx` range (e.g., `200 OK`). This acknowledges receipt to Lomi.

- **Respond Immediately:** Acknowledge the request _before_ performing any complex logic or external API calls that might time out.
- **Defer Processing:** If processing the event takes significant time, use a background job queue (like Redis/Celery, BullMQ, Sidekiq) to handle the work asynchronously after sending the `200 OK` response.

Failure to respond with a `2xx` status code within a reasonable timeframe (e.g., 10 seconds) will be considered a delivery failure by Lomi.

## 6. Retries

If Lomi doesn't receive a `2xx` response from your endpoint, it assumes the delivery failed and will automatically retry sending the webhook.

- Retries occur with an exponential backoff strategy (increasing delays between attempts).
- Lomi will attempt up to 3 retries after the initial failure.
- **Idempotency:** Because of retries (and potentially other network issues), your endpoint might receive the same event notification more than once. Design your event processing logic to be **idempotent**. This means processing the same event multiple times should not cause duplicate actions or errors. A common strategy is to check if you've already processed an event based on its unique `id` (`evt_...`) before taking action.

## 7. Testing Webhooks

You can test your endpoint integration using the "Test Webhook" feature in the Lomi Dashboard (Developers -> Webhooks -> Select Endpoint -> Test). This will send a test `PAYMENT_SUCCEEDED` event payload to your configured URL, allowing you to verify your endpoint's receiving and signature verification logic without performing a real transaction.

## 8. Best Practices Summary

- **Verify Signatures:** Always verify the `X-Lomi-Signature` using your signing secret and a timing-safe comparison.
- **Respond Quickly:** Send a `200 OK` response immediately upon receipt.
- **Process Asynchronously:** Defer complex logic to background jobs.
- **Handle Duplicates (Idempotency):** Design your system to gracefully handle receiving the same event multiple times. Check the event `id`.
- **Use HTTPS:** Ensure your endpoint uses HTTPS for secure communication.
- **Secure Your Secret:** Keep your webhook signing secret confidential. Do not commit it to version control. Use environment variables or a secrets manager.

## 9. Troubleshooting

- **Check Delivery Logs:** The Lomi Dashboard (Developers -> Webhooks -> Select Endpoint -> Logs) shows the history of delivery attempts for your endpoint, including success/failure status codes and response bodies captured by Lomi. This is useful for diagnosing issues.
- **Signature Mismatches:** Usually caused by using the wrong secret, modifying the payload before verification, or not using the raw request body.
- **Timeouts:** Ensure your endpoint responds within 10 seconds. Move heavy processing to the background.
- **Firewall/Network Issues:** Ensure your server/firewall allows incoming POST requests from Lomi's IP addresses (if IP filtering is used).
