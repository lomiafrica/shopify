import { Session } from "@shopify/shopify-api";
import type { Session as SessionInterface } from "@shopify/shopify-api";
import { supabaseAdmin } from "@/utils/supabase/server";

export class SupabaseSessionStorage {
  async storeSession(session: SessionInterface): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin.from("shopify_sessions").upsert(
        {
          id: session.id,
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline,
          scope: session.scope,
          expires: session.expires?.toISOString(),
          accessToken: session.accessToken,
          userId: session.onlineAccessInfo?.associated_user?.id,
          firstName: session.onlineAccessInfo?.associated_user?.first_name,
          lastName: session.onlineAccessInfo?.associated_user?.last_name,
          email: session.onlineAccessInfo?.associated_user?.email,
          accountOwner:
            session.onlineAccessInfo?.associated_user?.account_owner,
          locale: session.onlineAccessInfo?.associated_user?.locale,
          collaborator: session.onlineAccessInfo?.associated_user?.collaborator,
          emailVerified:
            session.onlineAccessInfo?.associated_user?.email_verified,
          expires_in: session.onlineAccessInfo?.expires_in,
          associated_user_scope:
            session.onlineAccessInfo?.associated_user_scope,
        },
        {
          onConflict: "id",
        },
      );

      return !error;
    } catch (error) {
      console.error("Error storing session:", error);
      return false;
    }
  }

  async loadSession(id: string): Promise<SessionInterface | undefined> {
    try {
      const { data: session, error } = await supabaseAdmin
        .from("shopify_sessions")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !session) {
        return undefined;
      }

      return this.deserializeSession(session);
    } catch (error) {
      console.error("Error loading session:", error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from("shopify_sessions")
        .delete()
        .eq("id", id);

      return !error;
    } catch (error) {
      console.error("Error deleting session:", error);
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from("shopify_sessions")
        .delete()
        .in("id", ids);

      return !error;
    } catch (error) {
      console.error("Error deleting sessions:", error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<SessionInterface[]> {
    try {
      const { data: sessions, error } = await supabaseAdmin
        .from("shopify_sessions")
        .select("*")
        .eq("shop", shop);

      if (error || !sessions) {
        return [];
      }

      return sessions.map((session) => this.deserializeSession(session));
    } catch (error) {
      console.error("Error finding sessions by shop:", error);
      return [];
    }
  }

  private deserializeSession(dbSession: any): SessionInterface {
    return new Session({
      id: dbSession.id,
      shop: dbSession.shop,
      state: dbSession.state,
      isOnline: dbSession.isOnline,
      scope: dbSession.scope,
      expires: dbSession.expires ? new Date(dbSession.expires) : undefined,
      accessToken: dbSession.accessToken,
      onlineAccessInfo: dbSession.userId
        ? {
            associated_user: {
              id: dbSession.userId,
              first_name: dbSession.firstName,
              last_name: dbSession.lastName,
              email: dbSession.email,
              account_owner: dbSession.accountOwner,
              locale: dbSession.locale,
              collaborator: dbSession.collaborator,
              email_verified: dbSession.emailVerified,
            },
            expires_in: dbSession.expires_in,
            associated_user_scope: dbSession.associated_user_scope,
          }
        : undefined,
    });
  }
}
