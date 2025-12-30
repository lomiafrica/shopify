import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { supabaseAdmin } from "../lib/supabase/server";

interface Transaction {
  transaction_id: string;
  created_at: string;
  gross_amount: number;
  net_amount: number;
  fee_amount: number;
  currency_code: string;
  status: string;
  transaction_type: string;
  customer_name?: string;
  customer_email?: string;
  product_name?: string;
  product_description?: string;
}

interface RawTransactionData {
  transaction_id: string;
  created_at: string;
  gross_amount: number;
  net_amount: number;
  fee_amount: number;
  gross_amount_xof?: number;
  net_amount_xof?: number;
  fee_amount_xof?: number;
  currency_code: string;
  status: string;
  transaction_type: string;
  customer_name?: string;
  customer_email?: string;
  product_name?: string;
  product_description?: string;
}

interface LoaderData {
  transactions: Transaction[];
  hasMore: boolean;
  totalCount?: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  if (!admin || !session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopDomain = session.shop;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
  const status = url.searchParams.get("status");
  const searchTerm = url.searchParams.get("search");

  if (!supabaseAdmin) {
    console.error("Supabase admin client not initialized.");
    return json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    // Verify that the Lomi API key is configured for this shop
    const { data: shopSettings, error: settingsError } =
      await supabaseAdmin.rpc("get_shopify_shop_settings", {
        p_shop: shopDomain,
      });

    if (settingsError || !shopSettings?.[0]?.api_key) {
      return json(
        {
          error:
            "Lomi API key not configured. Please set up your API key first.",
        },
        { status: 400 },
      );
    }

    // Get organization_id from shopify_stores
    const { data: storeData, error: storeError } = await supabaseAdmin
      .from("shopify_stores")
      .select("organization_id")
      .eq("shop_domain", shopDomain)
      .single();

    if (storeError || !storeData?.organization_id) {
      return json(
        { error: "Store not found or not configured" },
        { status: 404 },
      );
    }

    const organizationId = storeData.organization_id;

    // Fetch transactions using the fetch_transactions RPC function
    const { data: transactionsData, error: transactionsError } =
      await supabaseAdmin.rpc("fetch_transactions", {
        p_organization_id: organizationId,
        p_page: page,
        p_page_size: pageSize,
        p_status: status ? [status] : null,
        p_search_term: searchTerm || null,
        p_display_in_xof: true,
      });

    if (transactionsError) {
      console.error("Error fetching transactions:", transactionsError);
      return json({ error: "Failed to fetch transactions" }, { status: 500 });
    }

    // Get total count for pagination
    const { data: countData, error: countError } = await supabaseAdmin.rpc(
      "fetch_transaction_count",
      {
        p_organization_id: organizationId,
        p_environment: "live",
      },
    );

    const totalCount = countError ? 0 : countData || 0;
    const hasMore = page * pageSize < totalCount;

    // Transform the data to match our Transaction interface
    const transactions: Transaction[] = (transactionsData || []).map(
      (tx: RawTransactionData) => ({
        transaction_id: tx.transaction_id,
        created_at: tx.created_at,
        gross_amount: tx.gross_amount_xof || tx.gross_amount,
        net_amount: tx.net_amount_xof || tx.net_amount,
        fee_amount: tx.fee_amount_xof || tx.fee_amount,
        currency_code: "XOF", // Always display in XOF
        status: tx.status,
        transaction_type: tx.transaction_type,
        customer_name: tx.customer_name,
        customer_email: tx.customer_email,
        product_name: tx.product_name,
        product_description: tx.product_description,
      }),
    );

    return json<LoaderData>({
      transactions,
      hasMore,
      totalCount,
    });
  } catch (error) {
    console.error(`Error fetching transactions for shop ${shopDomain}:`, error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
