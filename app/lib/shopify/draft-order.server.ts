import { GraphqlClient } from "@shopify/shopify-api";
import type { Session } from "@shopify/shopify-api";
import { isJsonObject, validateJsonValue } from "@lomi./shared";
import type {
  CartJsItem,
  DraftOrderResult,
  ShopifyShippingMode,
} from "./types";

function variantGid(variantId: number): string {
  return `gid://shopify/ProductVariant/${variantId}`;
}

export function buildDraftOrderLineItems(cartItems: CartJsItem[]) {
  return cartItems
    .filter((item) => item.variant_id && item.quantity > 0)
    .map((item) => ({
      variantId: variantGid(item.variant_id),
      quantity: item.quantity,
    }));
}

interface CreateDraftOrderParams {
  session: Session;
  cartItems: CartJsItem[];
  shippingMode: ShopifyShippingMode;
  flatShippingFee: number | null;
  customerEmail?: string;
  transactionNote?: string;
}

export async function createDraftOrderFromCart({
  session,
  cartItems,
  shippingMode,
  flatShippingFee,
  customerEmail,
  transactionNote,
}: CreateDraftOrderParams): Promise<DraftOrderResult> {
  const lineItems = buildDraftOrderLineItems(cartItems);

  if (lineItems.length === 0) {
    throw new Error("Cart has no valid line items");
  }

  const client = new GraphqlClient({ session });

  const draftOrderInput = validateJsonValue({
    lineItems,
    tags: ["lomi-payment", "lomi-cart-bypass"],
    note: transactionNote || "Payment via lomi. (cart bypass)",
  });
  if (!isJsonObject(draftOrderInput)) {
    throw new TypeError("Draft order input must be a JSON object");
  }

  if (customerEmail) {
    draftOrderInput.email = customerEmail;
  }

  if (
    shippingMode === "subtotal_plus_flat_fee" &&
    flatShippingFee != null &&
    flatShippingFee > 0
  ) {
    draftOrderInput.shippingLine = {
      title: "Shipping",
      price: flatShippingFee.toFixed(2),
    };
  }

  const createMutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await client.query({
    data: {
      query: createMutation,
      variables: { input: draftOrderInput },
    },
  });

  // @ts-expect-error - response.body typing
  const result = response.body?.data?.draftOrderCreate;

  if (result?.userErrors?.length > 0) {
    const messages = result.userErrors
      .map((e: { message: string }) => e.message)
      .join("; ");
    throw new Error(`Draft order creation failed: ${messages}`);
  }

  const draftOrder = result?.draftOrder;
  if (!draftOrder?.id) {
    throw new Error("Draft order creation returned no order");
  }

  const amount = parseFloat(draftOrder.totalPriceSet?.shopMoney?.amount ?? "0");
  const currencyCode =
    draftOrder.totalPriceSet?.shopMoney?.currencyCode ?? "XOF";

  return {
    // SAFETY: Boundary value matches the asserted domain type at this call site.
    draftOrderId: draftOrder.id as string,
    // SAFETY: Boundary value matches the asserted domain type at this call site.
    draftOrderName: draftOrder.name as string,
    totalAmount: amount,
    currencyCode,
  };
}

export async function completeDraftOrder(
  session: Session,
  draftOrderId: string,
): Promise<{ orderId: string | null; orderName: string | null }> {
  const client = new GraphqlClient({ session });

  const mutation = `
    mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
      draftOrderComplete(id: $id, paymentPending: $paymentPending) {
        draftOrder {
          order {
            id
            name
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await client.query({
    data: {
      query: mutation,
      variables: {
        id: draftOrderId,
        paymentPending: false,
      },
    },
  });

  // @ts-expect-error - response.body typing
  const result = response.body?.data?.draftOrderComplete;

  if (result?.userErrors?.length > 0) {
    const messages = result.userErrors
      .map((e: { message: string }) => e.message)
      .join("; ");
    throw new Error(`Draft order completion failed: ${messages}`);
  }

  const order = result?.draftOrder?.order;
  return {
    orderId: order?.id ?? null,
    orderName: order?.name ?? null,
  };
}

export async function getDraftOrderStatus(
  session: Session,
  draftOrderId: string,
): Promise<{
  name: string | null;
  completed: boolean;
  orderName: string | null;
}> {
  const client = new GraphqlClient({ session });

  const query = `
    query draftOrder($id: ID!) {
      draftOrder(id: $id) {
        name
        status
        order {
          name
        }
      }
    }
  `;

  const response = await client.query({
    data: {
      query,
      variables: { id: draftOrderId },
    },
  });

  // @ts-expect-error - response.body typing
  const draftOrder = response.body?.data?.draftOrder;

  return {
    name: draftOrder?.name ?? null,
    completed: draftOrder?.status === "COMPLETED",
    orderName: draftOrder?.order?.name ?? null,
  };
}
