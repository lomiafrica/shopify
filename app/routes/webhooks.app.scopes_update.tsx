import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "@/utils/supabase/server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const currentScopes = payload?.current as string[] | undefined;

  if (session && currentScopes && currentScopes.length > 0) {
    const { error } = await supabaseAdmin
      .from('shopify_sessions')
      .update({ scope: currentScopes.join(',') })
      .eq('id', session.id);

    if (error) {
      console.error(`Failed to update session scope in Supabase for session ${session.id}:`, error.message);
    } else {
      console.log(`Successfully updated session scope in Supabase for session ${session.id}`);
    }
  } else {
    if (!session) console.warn("No session found for scopes_update webhook.");
    if (!currentScopes || currentScopes.length === 0) console.warn("No scopes found in payload for scopes_update webhook.");
  }
  return new Response(null, { status: 200 });
};
