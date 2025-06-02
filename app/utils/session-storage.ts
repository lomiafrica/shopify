import { Session } from "@shopify/shopify-api";
import type { Session as SessionInterface } from "@shopify/shopify-api";
import { supabaseAdmin } from "@/app/utils/supabase/server";

export class SupabaseSessionStorage {
  async storeSession(session: SessionInterface): Promise<boolean> {
    console.log("[SupabaseSessionStorage] Attempting to store session:", JSON.stringify(session, null, 2));
    try {
      const { error } = await supabaseAdmin.rpc("manage_shopify_session", {
        p_id: session.id,
        p_shop: session.shop,
        p_state: session.state,
        p_is_online: session.isOnline,
        p_scope: session.scope,
        p_expires: session.expires?.toISOString() || null,
        p_access_token: session.accessToken,
        p_user_id: session.onlineAccessInfo?.associated_user?.id || null,
        p_first_name: session.onlineAccessInfo?.associated_user?.first_name || null,
        p_last_name: session.onlineAccessInfo?.associated_user?.last_name || null,
        p_email: session.onlineAccessInfo?.associated_user?.email || null,
        p_account_owner: session.onlineAccessInfo?.associated_user?.account_owner || false,
        p_locale: session.onlineAccessInfo?.associated_user?.locale || null,
        p_collaborator: session.onlineAccessInfo?.associated_user?.collaborator || false,
        p_email_verified: session.onlineAccessInfo?.associated_user?.email_verified || false,
        p_expires_in: session.onlineAccessInfo?.expires_in || null,
        p_associated_user_scope: session.onlineAccessInfo?.associated_user_scope || null,
      });

      if (error) {
        console.error("[SupabaseSessionStorage] Error storing session via RPC:", JSON.stringify(error, null, 2));
        return false;
      }
      console.log("[SupabaseSessionStorage] Session stored successfully via RPC for id:", session.id);
      return true;
    } catch (error) {
      console.error("[SupabaseSessionStorage] Exception during storeSession:", error);
      return false;
    }
  }

  async loadSession(id: string): Promise<SessionInterface | undefined> {
    console.log("[SupabaseSessionStorage] Attempting to load session for id:", id);
    console.log("[SupabaseSessionStorage] Using supabaseAdmin client - checking connection...");

    try {
      // Use the find_shopify_session_by_id RPC function
      console.log("[SupabaseSessionStorage] About to call find_shopify_session_by_id with params:", { p_id: id });

      const { data: dbSessions, error } = await supabaseAdmin.rpc("find_shopify_session_by_id", {
        p_id: id,
      });

      console.log("[SupabaseSessionStorage] RPC response - data:", JSON.stringify(dbSessions, null, 2));
      console.log("[SupabaseSessionStorage] RPC response - error:", JSON.stringify(error, null, 2));

      if (error) {
        console.error("[SupabaseSessionStorage] Error loading session via RPC:", JSON.stringify(error, null, 2));
        return undefined;
      }

      if (!dbSessions || dbSessions.length === 0) {
        console.log("[SupabaseSessionStorage] No session found for id:", id);
        return undefined;
      }

      // The RPC returns an array, but we expect only one session
      const dbSession = dbSessions[0];

      console.log("[SupabaseSessionStorage] Session data loaded via RPC:", JSON.stringify(dbSession, null, 2));
      const deserializedSession = this.deserializeSession(dbSession);
      console.log("[SupabaseSessionStorage] Session deserialized successfully for id:", id);
      return deserializedSession;
    } catch (error) {
      console.error("[SupabaseSessionStorage] Exception during loadSession:", error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    console.log("[SupabaseSessionStorage] Attempting to delete session for id:", id);
    try {
      const { error } = await supabaseAdmin.rpc("delete_shopify_session", {
        p_id: id,
      });

      if (error) {
        console.error("[SupabaseSessionStorage] Error deleting session via RPC:", JSON.stringify(error, null, 2));
        return false;
      }
      console.log("[SupabaseSessionStorage] Session deleted successfully via RPC for id:", id);
      return true;
    } catch (error) {
      console.error("[SupabaseSessionStorage] Exception during deleteSession:", error);
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    console.log("[SupabaseSessionStorage] Attempting to delete sessions for ids:", ids);
    try {
      const { error } = await supabaseAdmin.rpc("delete_shopify_sessions", {
        p_ids: ids,
      });

      if (error) {
        console.error("[SupabaseSessionStorage] Error deleting sessions via RPC:", JSON.stringify(error, null, 2));
        return false;
      }
      console.log("[SupabaseSessionStorage] Sessions deleted successfully via RPC for ids:", ids);
      return true;
    } catch (error) {
      console.error("[SupabaseSessionStorage] Exception during deleteSessions:", error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<SessionInterface[]> {
    console.log("[SupabaseSessionStorage] Attempting to find sessions by shop:", shop);
    try {
      const { data: dbSessions, error } = await supabaseAdmin.rpc("find_shopify_sessions_by_shop", {
        p_shop: shop,
      });

      if (error) {
        console.error("[SupabaseSessionStorage] Error finding sessions by shop via RPC:", JSON.stringify(error, null, 2));
        return [];
      }

      if (!dbSessions || dbSessions.length === 0) {
        console.log("[SupabaseSessionStorage] No sessions found for shop:", shop);
        return [];
      }

      console.log(`[SupabaseSessionStorage] Found ${dbSessions.length} session(s) for shop ${shop} via RPC.`);
      return dbSessions.map((session: any) => this.deserializeSession(session));
    } catch (error) {
      console.error("[SupabaseSessionStorage] Exception during findSessionsByShop:", error);
      return [];
    }
  }

  private deserializeSession(dbSession: any): SessionInterface {
    // Ensure 'expires' is undefined if not a valid date string, not new Date(null)
    const expiresDate = dbSession.expires ? new Date(dbSession.expires) : undefined;

    // Prefer camelCase, fallback to lowercase for compatibility if necessary,
    // but ideally the database/RPC should be consistent.
    const isOnline = dbSession.isOnline !== undefined ? dbSession.isOnline : dbSession.isonline;
    const accessToken = dbSession.accessToken !== undefined ? dbSession.accessToken : dbSession.accesstoken;
    const userId = dbSession.userId !== undefined ? dbSession.userId : dbSession.userid;
    const firstName = dbSession.firstName !== undefined ? dbSession.firstName : dbSession.firstname;
    const lastName = dbSession.lastName !== undefined ? dbSession.lastName : dbSession.lastname;
    const accountOwner = dbSession.accountOwner !== undefined ? dbSession.accountOwner : dbSession.accountowner;
    const emailVerified = dbSession.emailVerified !== undefined ? dbSession.emailVerified : dbSession.emailverified;

    return new Session({
      id: dbSession.id,
      shop: dbSession.shop,
      state: dbSession.state,
      isOnline: isOnline,
      scope: dbSession.scope,
      expires: expiresDate,
      accessToken: accessToken,
      onlineAccessInfo: userId
        ? {
            associated_user: {
              id: userId,
              first_name: firstName,
              last_name: lastName,
              email: dbSession.email, // Assuming email is consistently cased
              account_owner: accountOwner,
              locale: dbSession.locale, // Assuming locale is consistently cased
              collaborator: dbSession.collaborator, // Assuming collaborator is consistently cased
              email_verified: emailVerified,
            },
            // These fields seem to be directly from Shopify and likely consistently cased
            expires_in: dbSession.expires_in,
            associated_user_scope: dbSession.associated_user_scope,
          }
        : undefined,
    });
  }
}
