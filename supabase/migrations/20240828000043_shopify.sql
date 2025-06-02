-- Migration to move Shopify schema to public with shopify_ prefixes
-- This fixes RPC function 404 issues with Supabase PostgREST API

-- First, drop the entire shopify schema
DROP SCHEMA IF EXISTS shopify CASCADE;

-- Create Shopify tables in public schema with shopify_ prefix
CREATE TABLE shopify_stores (
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

-- Shopify API Keys table
CREATE TABLE shopify_api_keys (
    api_key_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES shopify_stores(store_id) ON DELETE CASCADE,
    lomi_api_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id) -- Each store should have only one Lomi API key configuration
);

COMMENT ON TABLE shopify_api_keys IS 'Stores Lomi API keys for Shopify stores, linked to the shopify_stores table.';

CREATE INDEX idx_shopify_api_keys_store_id ON shopify_api_keys(store_id);

-- Shop settings table for api.settings.ts
CREATE TABLE shopify_shop_settings (
    settings_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop VARCHAR NOT NULL UNIQUE,
    api_key VARCHAR,
    api_secret VARCHAR,
    merchant_id VARCHAR,
    webhook_url VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE shopify_shop_settings IS 'Stores shop-specific settings for Shopify stores used by api.settings.ts';

CREATE INDEX idx_shopify_shop_settings_shop ON shopify_shop_settings(shop);

-- Webhooks table
CREATE TABLE shopify_webhooks (
    webhook_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES shopify_stores(store_id),
    topic VARCHAR NOT NULL,
    address VARCHAR NOT NULL,
    shopify_webhook_id VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, topic)
);

-- Sessions table
CREATE TABLE shopify_sessions (
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

COMMENT ON TABLE shopify_sessions IS 'Stores Shopify session data for authentication';

-- Enable RLS on all tables
ALTER TABLE shopify_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organizations can manage Lomi API keys for their own stores"
    ON shopify_api_keys
    FOR ALL
    TO authenticated
    USING (store_id IN (
        SELECT s.store_id
        FROM shopify_stores s
        WHERE s.organization_id IN (
            SELECT mol.organization_id
            FROM public.merchant_organization_links mol
            WHERE mol.merchant_id = (SELECT auth.uid()::uuid)
        )
    ));

CREATE POLICY "Service role can manage shop settings"
    ON shopify_shop_settings
    FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Organizations can manage their own stores"
    ON shopify_stores
    FOR ALL
    TO authenticated
    USING (organization_id IN (
        SELECT mol.organization_id
        FROM merchant_organization_links mol
        WHERE mol.merchant_id = (SELECT auth.uid()::uuid)
    ));

CREATE POLICY "Organizations can manage their store webhooks"
    ON shopify_webhooks
    FOR ALL
    TO authenticated
    USING (store_id IN (
        SELECT s.store_id
        FROM shopify_stores s
        WHERE s.organization_id IN (
            SELECT mol.organization_id
            FROM public.merchant_organization_links mol
            WHERE mol.merchant_id = (SELECT auth.uid()::uuid)
        )
    ));

CREATE POLICY "Organizations can manage their store sessions"
    ON shopify_sessions
    FOR ALL
    TO authenticated
    USING (shop IN (
        SELECT s.shop_domain
        FROM shopify_stores s
        WHERE s.organization_id IN (
            SELECT mol.organization_id
            FROM merchant_organization_links mol
            WHERE mol.merchant_id = (SELECT auth.uid()::uuid)
        )
    ));

-- Service role policy for shopify sessions
CREATE POLICY "Service role can manage shopify sessions"
    ON shopify_sessions
    FOR ALL
    TO service_role
    USING (true);

-- RPC Functions (now in public schema)

CREATE OR REPLACE FUNCTION install_shopify_store(
    p_organization_id UUID,
    p_shop_domain VARCHAR,
    p_access_token VARCHAR,
    p_scope VARCHAR[]
) RETURNS UUID AS $$
DECLARE
    v_store_id UUID;
BEGIN
    INSERT INTO shopify_stores (
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION manage_shopify_session(
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
    INSERT INTO shopify_sessions (
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION delete_shopify_session(p_id TEXT) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM shopify_sessions WHERE id = p_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION delete_shopify_sessions(p_ids TEXT[]) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM shopify_sessions WHERE id = ANY(p_ids);
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION delete_shopify_sessions_by_shop(p_shop TEXT) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM shopify_sessions WHERE shop = p_shop;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION update_shopify_session_scope(p_session_id TEXT, p_scope TEXT) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE shopify_sessions SET scope = p_scope, updated_at = NOW() WHERE id = p_session_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Shop settings RPC functions
CREATE OR REPLACE FUNCTION get_shopify_shop_settings(p_shop TEXT) RETURNS SETOF shopify_shop_settings AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM shopify_shop_settings WHERE shop = p_shop;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION upsert_shopify_shop_settings(
    p_shop TEXT,
    p_api_key VARCHAR,
    p_api_secret VARCHAR,
    p_merchant_id VARCHAR,
    p_webhook_url VARCHAR
) RETURNS SETOF shopify_shop_settings AS $$
BEGIN
    RETURN QUERY
    INSERT INTO shopify_shop_settings (shop, api_key, api_secret, merchant_id, webhook_url, updated_at)
    VALUES (p_shop, p_api_key, p_api_secret, p_merchant_id, p_webhook_url, NOW())
    ON CONFLICT (shop) DO UPDATE
    SET api_key = EXCLUDED.api_key,
        api_secret = EXCLUDED.api_secret,
        merchant_id = EXCLUDED.merchant_id,
        webhook_url = EXCLUDED.webhook_url,
        updated_at = NOW()
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION find_shopify_sessions_by_shop(p_shop TEXT) RETURNS SETOF shopify_sessions AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM shopify_sessions WHERE shop = p_shop;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION find_shopify_session_by_id(p_id TEXT) RETURNS SETOF shopify_sessions AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM shopify_sessions WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION register_shopify_webhook(
    p_store_id UUID,
    p_topic VARCHAR,
    p_address VARCHAR,
    p_shopify_webhook_id VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_webhook_id UUID;
BEGIN
    INSERT INTO shopify_webhooks (
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Lomi API Key Management Functions
CREATE OR REPLACE FUNCTION get_shopify_lomi_api_key(
    p_store_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_api_key TEXT;
BEGIN
    SELECT lomi_api_key
    INTO v_api_key
    FROM shopify_api_keys
    WHERE store_id = p_store_id;

    RETURN v_api_key;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp;

COMMENT ON FUNCTION get_shopify_lomi_api_key(UUID) IS 'Retrieves the Lomi API key for a given store_id from shopify_api_keys.';

CREATE OR REPLACE FUNCTION upsert_shopify_lomi_api_key(
    p_store_id UUID,
    p_lomi_api_key TEXT
) RETURNS SETOF shopify_api_keys AS $$
BEGIN
    RETURN QUERY
    INSERT INTO shopify_api_keys (store_id, lomi_api_key, updated_at)
    VALUES (p_store_id, p_lomi_api_key, NOW())
    ON CONFLICT (store_id) DO UPDATE
    SET lomi_api_key = EXCLUDED.lomi_api_key,
        updated_at = NOW()
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp;

COMMENT ON FUNCTION upsert_shopify_lomi_api_key(UUID, TEXT) IS 'Upserts a Lomi API key into shopify_api_keys for a given store_id. Assumes the key has been validated elsewhere.';

CREATE OR REPLACE FUNCTION validate_and_store_shopify_lomi_key_for_shop(
    p_shop_domain TEXT,
    p_lomi_api_key_to_validate TEXT
) RETURNS JSONB AS $$
DECLARE
    v_store_record shopify_stores%ROWTYPE;
    v_validation_result RECORD;
    v_calling_user_id UUID := auth.uid(); -- The user making the request via Shopify app
    v_expected_merchant_id UUID; -- Merchant ID linked to the auth.uid(), to be checked against the key's merchant_id
    v_key_merchant_id UUID;
    v_key_organization_id UUID;
    v_key_is_valid BOOLEAN;
    v_key_message TEXT;
BEGIN
    -- Get the merchant_id associated with the currently authenticated Supabase user
    SELECT merchant_id INTO v_expected_merchant_id FROM public.users WHERE id = v_calling_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authenticated user not linked to a merchant.');
    END IF;

    -- Fetch store details based on shop_domain
    SELECT * INTO v_store_record FROM shopify_stores WHERE shop_domain = p_shop_domain;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Shop not found for domain: ' || p_shop_domain);
    END IF;

    -- Call the central API key verification function
    SELECT result.is_valid, result.merchant_id, result.organization_id, result.message
    INTO v_key_is_valid, v_key_merchant_id, v_key_organization_id, v_key_message
    FROM public.verify_api_key(p_api_key := p_lomi_api_key_to_validate, p_endpoint := 'shopify_app_lomi_key_setup') as result;

    IF v_key_is_valid IS NULL THEN
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
    PERFORM upsert_shopify_lomi_api_key(v_store_record.store_id, p_lomi_api_key_to_validate);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Grant necessary permissions to service_role
GRANT ALL ON shopify_stores TO service_role;
GRANT ALL ON shopify_api_keys TO service_role;
GRANT ALL ON shopify_shop_settings TO service_role;
GRANT ALL ON shopify_webhooks TO service_role;
GRANT ALL ON shopify_sessions TO service_role;

GRANT EXECUTE ON FUNCTION install_shopify_store(UUID, VARCHAR, VARCHAR, VARCHAR[]) TO service_role;
GRANT EXECUTE ON FUNCTION manage_shopify_session(TEXT, TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, BIGINT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN, BOOLEAN, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION delete_shopify_session(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION delete_shopify_sessions(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION delete_shopify_sessions_by_shop(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_shopify_session_scope(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_shopify_shop_settings(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_shopify_shop_settings(TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION find_shopify_sessions_by_shop(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION find_shopify_session_by_id(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION register_shopify_webhook(UUID, VARCHAR, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION get_shopify_lomi_api_key(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_shopify_lomi_api_key(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION validate_and_store_shopify_lomi_key_for_shop(TEXT, TEXT) TO service_role;
