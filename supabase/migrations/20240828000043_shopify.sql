-- Create Shopify schema
CREATE SCHEMA IF NOT EXISTS shopify;

-- Create Shopify tables in the new schema
CREATE TABLE shopify.stores (
    store_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(organization_id),
    shop_domain VARCHAR NOT NULL,
    access_token VARCHAR NOT NULL,
    scope VARCHAR[] NOT NULL,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    uninstalled_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, shop_domain)
);

-- Add the new table for Lomi API Keys
CREATE TABLE shopify.api_keys (
    api_key_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES shopify.stores(store_id) ON DELETE CASCADE,
    lomi_api_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id) -- Each store should have only one Lomi API key configuration
);

COMMENT ON TABLE shopify.api_keys IS 'Stores Lomi API keys for Shopify stores, linked to the shopify.stores table.';

CREATE INDEX idx_shopify_api_keys_store_id ON shopify.api_keys(store_id);

CREATE TABLE shopify.webhooks (
    webhook_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES shopify.stores(store_id),
    topic VARCHAR NOT NULL,
    address VARCHAR NOT NULL,
    shopify_webhook_id VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, topic)
);

CREATE TABLE shopify.sessions (
    id TEXT PRIMARY KEY,
    shop TEXT NOT NULL,
    state TEXT NOT NULL,
    isOnline BOOLEAN NOT NULL DEFAULT false,
    scope TEXT,
    expires TIMESTAMPTZ,
    accessToken TEXT NOT NULL,
    userId BIGINT,
    firstName TEXT,
    lastName TEXT,
    email TEXT,
    accountOwner BOOLEAN NOT NULL DEFAULT false,
    locale TEXT,
    collaborator BOOLEAN DEFAULT false,
    emailVerified BOOLEAN DEFAULT false,
    expires_in INTEGER,
    associated_user_scope TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE shopify.sessions IS 'Stores Shopify session data for authentication';

-- Add RLS policies
ALTER TABLE shopify.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify.sessions ENABLE ROW LEVEL SECURITY;

-- Add RLS for the new api_keys table
ALTER TABLE shopify.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations can manage Lomi API keys for their own stores"
    ON shopify.api_keys
    FOR ALL
    TO authenticated
    USING (store_id IN (
        SELECT s.store_id
        FROM shopify.stores s
        WHERE s.organization_id IN (
            SELECT mol.organization_id
            FROM public.merchant_organization_links mol -- Assuming merchant_organization_links is in public schema
            WHERE mol.merchant_id = (SELECT auth.uid()::uuid)
        )
    ));

-- Add RLS policies for stores
CREATE POLICY "Organizations can manage their own stores"
    ON shopify.stores
    FOR ALL
    TO authenticated
    USING (organization_id IN (
        SELECT mol.organization_id
        FROM merchant_organization_links mol
        WHERE mol.merchant_id = (SELECT auth.uid()::uuid)
    ));

-- Add RLS policies for webhooks
CREATE POLICY "Organizations can manage their store webhooks"
    ON shopify.webhooks
    FOR ALL
    TO authenticated
    USING (store_id IN (
        SELECT s.store_id
        FROM shopify.stores s
        WHERE s.organization_id IN (
            SELECT mol.organization_id
            FROM public.merchant_organization_links mol
            WHERE mol.merchant_id = (SELECT auth.uid()::uuid)
        )
    ));

-- Add RLS policies for sessions
CREATE POLICY "Organizations can manage their store sessions"
    ON shopify.sessions
    FOR ALL
    TO authenticated
    USING (shop IN (
        SELECT s.shop_domain
        FROM shopify.stores s
        WHERE s.organization_id IN (
            SELECT mol.organization_id
            FROM merchant_organization_links mol
            WHERE mol.merchant_id = (SELECT auth.uid()::uuid)
        )
    ));

-- Create RPC functions in the shopify schema
CREATE OR REPLACE FUNCTION shopify.install_store(
    p_organization_id UUID,
    p_shop_domain VARCHAR,
    p_access_token VARCHAR,
    p_scope VARCHAR[]
) RETURNS UUID AS $$
DECLARE
    v_store_id UUID;
BEGIN
    INSERT INTO shopify.stores (
        organization_id,
        shop_domain,
        access_token,
        scope
    ) VALUES (
        p_organization_id,
        p_shop_domain,
        p_access_token,
        p_scope
    )
    RETURNING store_id INTO v_store_id;

    RETURN v_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = shopify, public, pg_temp;

CREATE OR REPLACE FUNCTION shopify.manage_session(
    p_id TEXT,
    p_shop TEXT,
    p_state TEXT,
    p_is_online BOOLEAN,
    p_scope TEXT,
    p_expires TIMESTAMPTZ,
    p_access_token TEXT,
    p_user_id BIGINT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_email TEXT,
    p_account_owner BOOLEAN,
    p_locale TEXT,
    p_collaborator BOOLEAN,
    p_email_verified BOOLEAN,
    p_expires_in INTEGER,
    p_associated_user_scope TEXT
) RETURNS TEXT AS $$
BEGIN
    INSERT INTO shopify.sessions (
        id,
        shop,
        state,
        isOnline,
        scope,
        expires,
        accessToken,
        userId,
        firstName,
        lastName,
        email,
        accountOwner,
        locale,
        collaborator,
        emailVerified,
        expires_in,
        associated_user_scope
    ) VALUES (
        p_id,
        p_shop,
        p_state,
        p_is_online,
        p_scope,
        p_expires,
        p_access_token,
        p_user_id,
        p_first_name,
        p_last_name,
        p_email,
        p_account_owner,
        p_locale,
        p_collaborator,
        p_email_verified,
        p_expires_in,
        p_associated_user_scope
    )
    ON CONFLICT (id) DO UPDATE
    SET
        shop = EXCLUDED.shop,
        state = EXCLUDED.state,
        isOnline = EXCLUDED.isOnline,
        scope = EXCLUDED.scope,
        expires = EXCLUDED.expires,
        accessToken = EXCLUDED.accessToken,
        userId = EXCLUDED.userId,
        firstName = EXCLUDED.firstName,
        lastName = EXCLUDED.lastName,
        email = EXCLUDED.email,
        accountOwner = EXCLUDED.accountOwner,
        locale = EXCLUDED.locale,
        collaborator = EXCLUDED.collaborator,
        emailVerified = EXCLUDED.emailVerified,
        expires_in = EXCLUDED.expires_in,
        associated_user_scope = EXCLUDED.associated_user_scope,
        updated_at = NOW();

    RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = shopify, public, pg_temp;

CREATE OR REPLACE FUNCTION shopify.delete_session(p_id TEXT) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM shopify.sessions WHERE id = p_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = shopify, public, pg_temp;

CREATE OR REPLACE FUNCTION shopify.delete_sessions(p_ids TEXT[]) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM shopify.sessions WHERE id = ANY(p_ids);
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = shopify, public, pg_temp;

CREATE OR REPLACE FUNCTION shopify.find_sessions_by_shop(p_shop TEXT) RETURNS SETOF shopify.sessions AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM shopify.sessions WHERE shop = p_shop;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = shopify, public, pg_temp;

CREATE OR REPLACE FUNCTION shopify.register_webhook(
    p_store_id UUID,
    p_topic VARCHAR,
    p_address VARCHAR,
    p_shopify_webhook_id VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_webhook_id UUID;
BEGIN
    INSERT INTO shopify.webhooks (
        store_id,
        topic,
        address,
        shopify_webhook_id
    ) VALUES (
        p_store_id,
        p_topic,
        p_address,
        p_shopify_webhook_id
    )
    RETURNING webhook_id INTO v_webhook_id;

    RETURN v_webhook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = shopify, public, pg_temp;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA shopify TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA shopify TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA shopify TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA shopify TO service_role;

-- New RPC Functions for Lomi API Key Management

CREATE OR REPLACE FUNCTION shopify.get_lomi_api_key(
    p_store_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_api_key TEXT;
BEGIN
    SELECT lomi_api_key
    INTO v_api_key
    FROM shopify.api_keys
    WHERE store_id = p_store_id;

    RETURN v_api_key;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = shopify, public, pg_temp;

COMMENT ON FUNCTION shopify.get_lomi_api_key(UUID) IS 'Retrieves the Lomi API key for a given store_id from shopify.api_keys.';

CREATE OR REPLACE FUNCTION shopify.upsert_lomi_api_key(
    p_store_id UUID,
    p_lomi_api_key TEXT
) RETURNS SETOF shopify.api_keys AS $$
BEGIN
    RETURN QUERY
    INSERT INTO shopify.api_keys (store_id, lomi_api_key, updated_at)
    VALUES (p_store_id, p_lomi_api_key, NOW())
    ON CONFLICT (store_id) DO UPDATE
    SET lomi_api_key = EXCLUDED.lomi_api_key,
        updated_at = NOW()
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = shopify, public, pg_temp;

COMMENT ON FUNCTION shopify.upsert_lomi_api_key(UUID, TEXT) IS 'Upserts a Lomi API key into shopify.api_keys for a given store_id. Assumes the key has been validated elsewhere.';

CREATE OR REPLACE FUNCTION shopify.validate_and_store_lomi_key_for_shop(
    p_shop_domain TEXT,
    p_lomi_api_key_to_validate TEXT
) RETURNS JSONB AS $$
DECLARE
    v_store_record shopify.stores%ROWTYPE;
    v_validation_result RECORD;
    v_calling_user_id UUID := auth.uid(); -- The user making the request via Shopify app
    v_expected_merchant_id UUID; -- Merchant ID linked to the auth.uid(), to be checked against the key's merchant_id
    v_key_merchant_id UUID;
    v_key_organization_id UUID;
    v_key_is_valid BOOLEAN;
    v_key_message TEXT;
BEGIN
    -- Get the merchant_id associated with the currently authenticated Supabase user
    -- This assumes you have a way to link auth.uid() to a merchant_id in your public.users or a similar table.
    -- Adjust this query as per your actual schema for linking auth.uid() to a merchant_id.
    SELECT merchant_id INTO v_expected_merchant_id FROM public.users WHERE id = v_calling_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authenticated user not linked to a merchant.');
    END IF;

    -- Fetch store details based on shop_domain
    SELECT * INTO v_store_record FROM shopify.stores WHERE shop_domain = p_shop_domain;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Shop not found for domain: ' || p_shop_domain);
    END IF;

    -- Ensure the authenticated user (via its organization) has access to this store
    -- This relies on RLS on shopify.stores. An additional explicit check can be added if needed.
    -- For example, check if v_store_record.organization_id is in the list of orgs for v_expected_merchant_id.

    -- Call the central API key verification function
    -- Assuming public.verify_api_key returns at least: is_valid (boolean), merchant_id (uuid), organization_id (uuid), message (text)
    SELECT result.is_valid, result.merchant_id, result.organization_id, result.message
    INTO v_key_is_valid, v_key_merchant_id, v_key_organization_id, v_key_message
    FROM public.verify_api_key(p_api_key := p_lomi_api_key_to_validate, p_endpoint := 'shopify_app_lomi_key_setup') as result;

    IF v_key_is_valid IS NULL THEN
        -- This case handles if verify_api_key itself errors or returns an unexpected structure
        RETURN jsonb_build_object('success', false, 'message', 'API key validation service returned an unexpected result.');
    END IF;

    IF NOT v_key_is_valid THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lomi API key validation failed: ' || COALESCE(v_key_message, 'Unknown reason'), 'details', jsonb_build_object('is_valid', v_key_is_valid, 'merchant_id', v_key_merchant_id, 'organization_id', v_key_organization_id));
    END IF;

    -- Critical Check 1: Does the merchant owning the API key match the authenticated Shopify merchant?
    IF v_key_merchant_id != v_expected_merchant_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'API key does not belong to the authenticated merchant.');
    END IF;

    -- Critical Check 2: Does the organization tied to the API key match the organization of the Shopify store?
    IF v_key_organization_id != v_store_record.organization_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'API key organization does not match the stores organization.');
    END IF;

    -- If all checks pass, upsert the API key
    PERFORM shopify.upsert_lomi_api_key(v_store_record.store_id, p_lomi_api_key_to_validate);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Lomi API key validated and stored successfully.',
        'store_id', v_store_record.store_id,
        'organization_id', v_store_record.organization_id,
        'lomi_api_key_masked', LEFT(p_lomi_api_key_to_validate, 4) || '...' || RIGHT(p_lomi_api_key_to_validate, 4)
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'An unexpected error occurred: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = shopify, public, pg_temp;

COMMENT ON FUNCTION shopify.validate_and_store_lomi_key_for_shop(TEXT, TEXT) IS 'Validates a Lomi API key using public.verify_api_key, checks its association with the shop domains organization and authenticated merchant, and stores it in shopify.api_keys if valid.';
