import { supabaseAdmin } from "./server";

interface ShopifyLomiApiKey {
  api_key_id: string;
  store_id: string;
  lomi_api_key: string;
  created_at: string;
  updated_at: string;
}

/**
 * Retrieves the Lomi API key for a given Shopify store_id using RPC.
 * store_id is the UUID from the shopify_stores table.
 */
export async function getLomiApiKeyByStoreId(
  storeId: string,
): Promise<string | null> {
  if (!supabaseAdmin) {
    console.error("Supabase admin client is not initialized.");
    throw new Error("Supabase admin client is not initialized.");
  }

  const { data, error } = await supabaseAdmin.rpc("get_shopify_lomi_api_key", {
    p_store_id: storeId,
  });

  if (error) {
    console.error("Error calling RPC get_shopify_lomi_api_key:", error);
    if (error.code && error.code === "PGRST116") {
      return null;
    }
    if (data === null && error) {
      throw error;
    }
  }
  // SAFETY: Boundary value matches the asserted domain type at this call site.
  return data as string | null;
}

/**
 * Saves or updates the Lomi API key for a given Shopify store_id using RPC.
 * store_id is the UUID from the shopify_stores table.
 * This function assumes the API key has already been validated.
 */
export async function saveLomiApiKey(
  storeId: string,
  apiKey: string,
): Promise<ShopifyLomiApiKey | null> {
  if (!supabaseAdmin) {
    console.error("Supabase admin client is not initialized.");
    throw new Error("Supabase admin client is not initialized.");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "upsert_shopify_lomi_api_key",
    {
      p_store_id: storeId,
      p_lomi_api_key: apiKey,
    },
  );

  if (error) {
    console.error("Error calling RPC upsert_shopify_lomi_api_key:", error);
    throw error;
  }
  // The RPC returns SETOF shopify_api_keys, so data will be an array.
  // Since we upsert based on a unique store_id, we expect one row.
  // SAFETY: Boundary value matches the asserted domain type at this call site.
  return data && data.length > 0 ? (data[0] as ShopifyLomiApiKey) : null;
}
