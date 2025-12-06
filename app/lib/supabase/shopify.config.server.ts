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
    // PGRST116 (No rows found) might not apply directly to RPCs returning a single value like TEXT
    // Check if data is null or error indicates not found, if RPC is designed to error on not found.
    // For now, we assume if there's an error, it's problematic, or data is null if not found.
    console.error("Error calling RPC get_shopify_lomi_api_key:", error);
    // If the RPC returns null for not found without erroring, this throw might be too aggressive.
    // However, if it errors on not found, this is fine.
    // Let's assume the RPC returns null if not found and doesn't error for that specific case.
    // If error.code suggests 'not found', we can return null, otherwise throw.
    // For simplicity, if the RPC is designed to return null and not error on "not found":
    if (error.code && error.code === "PGRST116") {
      // Example, RPC might not use this code
      return null;
    }
    // If it's any other error, or if the RPC is expected to error on not found:
    // throw error;
    // For now, let's be a bit more forgiving and assume null data means not found or actual error
    // The RPC `get_shopify_lomi_api_key` simply returns TEXT or NULL from select, so error means something else went wrong.
    if (data === null && error) {
      // If data is null AND there is an error, then it is an actual error.
      throw error;
    }
  }
  return data as string | null; // data should be string (api key) or null
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
  return data && data.length > 0 ? (data[0] as ShopifyLomiApiKey) : null;
}
