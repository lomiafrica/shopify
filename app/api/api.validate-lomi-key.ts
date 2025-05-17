import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { authenticate } from '~/shopify.server'; // Assuming this is your Shopify admin authentication utility
import { supabaseAdmin } from '../utils/supabase/server'; // Corrected relative path

interface ActionData {
  success: boolean;
  message: string;
  store_id?: string;
  organization_id?: string;
  lomi_api_key_masked?: string;
  errorDetails?: unknown;
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  if (!admin || !session) {
    return json<ActionData>({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const shopDomain = session.shop;
  let lomiApiKey = '';

  try {
    const formData = await request.formData();
    const keyFromForm = formData.get('lomiApiKey');
    if (typeof keyFromForm !== 'string' || !keyFromForm.trim()) {
      return json<ActionData>({ success: false, message: 'Lomi API Key is required.' }, { status: 400 });
    }
    lomiApiKey = keyFromForm.trim();
  } catch (error) {
    console.error('Error parsing form data:', error);
    return json<ActionData>({ success: false, message: 'Invalid request data.' }, { status: 400 });
  }

  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialized for API route.');
    return json<ActionData>({ success: false, message: 'Server configuration error.' }, { status: 500 });
  }

  try {
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'validate_and_store_lomi_key_for_shop',
      {
        p_shop_domain: shopDomain,
        p_lomi_api_key_to_validate: lomiApiKey,
      }
    );

    if (rpcError) {
      console.error(`RPC 'validate_and_store_lomi_key_for_shop' error for shop ${shopDomain}:`, rpcError);
      return json<ActionData>(
        { success: false, message: rpcError.message || 'Error validating and storing API key.', errorDetails: rpcError },
        { status: 500 }
      );
    }

    // Assuming the RPC returns JSONB with a structure like: { success: boolean, message: string, ...other_details }
    const result = rpcData as ActionData; // Adjust type assertion based on actual RPC return

    if (!result || typeof result.success !== 'boolean') {
        console.error(`Invalid RPC response structure for shop ${shopDomain}:`, result);
        return json<ActionData>({ success: false, message: 'Invalid response from validation service.' }, { status: 500 });
    }

    return json<ActionData>(result, { status: result.success ? 200 : 400 });

  } catch (error) {
    console.error(`Unexpected error in /api/validate-lomi-key for shop ${shopDomain}:`, error);
    let errorMessage = 'Internal server error during key validation.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return json<ActionData>({ success: false, message: errorMessage, errorDetails: error }, { status: 500 });
  }
}

// Optional: Add a loader if you need to display any data on GET requests to this route
// export async function loader({ request }: LoaderFunctionArgs) {
//   await authenticate.admin(request);
//   return json({});
// }
