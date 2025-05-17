-- API System RPC functions
-- This migration contains functions to support the API pass-through to Supabase

-- Funtion to get Merchant-Org ID
CREATE OR REPLACE FUNCTION public.get_merchant_organization_id(p_merchant_id UUID)
RETURNS UUID AS $$
DECLARE
    v_organization_id UUID;
BEGIN
    SELECT organization_id INTO v_organization_id
    FROM merchant_organization_links
    WHERE merchant_id = p_merchant_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'No organization found for merchant_id %', p_merchant_id;
    END IF;

    RETURN v_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to get a specific payment link by ID
CREATE OR REPLACE FUNCTION public.get_payment_link(
    p_link_id UUID,
    p_merchant_id UUID DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
    link_id UUID,
    merchant_id UUID,
    organization_id UUID,
    link_type link_type,
    url VARCHAR(2048),
    product_id UUID,
    product_name VARCHAR(255),
    product_price NUMERIC(10,2),
    plan_id UUID,
    plan_name VARCHAR(255),
    plan_amount NUMERIC(10,2),
    title VARCHAR(255),
    public_description TEXT,
    private_description TEXT,
    price NUMERIC(10,2),
    currency_code currency_code,
    allowed_providers provider_code[],
    allow_coupon_code BOOLEAN,
    is_active BOOLEAN,
    expires_at TIMESTAMPTZ,
    success_url VARCHAR(2048),
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pl.link_id,
        pl.merchant_id,
        pl.organization_id,
        pl.link_type,
        pl.url,
        pl.product_id,
        mp.name AS product_name,
        mp.price AS product_price,
        pl.plan_id,
        sp.name AS plan_name,
        sp.amount AS plan_amount,
        pl.title,
        pl.public_description,
        pl.private_description,
        pl.price,
        pl.currency_code,
        pl.allowed_providers,
        pl.allow_coupon_code,
        pl.is_active,
        pl.expires_at,
        pl.success_url,
        pl.metadata,
        pl.created_at,
        pl.updated_at
    FROM
        payment_links pl
        LEFT JOIN merchant_products mp ON pl.product_id = mp.product_id
        LEFT JOIN subscription_plans sp ON pl.plan_id = sp.plan_id
    WHERE
        pl.link_id = p_link_id AND
        (p_merchant_id IS NULL OR pl.merchant_id = p_merchant_id) AND
        (p_organization_id IS NULL OR pl.organization_id = p_organization_id)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- List Checkout Sessions
CREATE OR REPLACE FUNCTION public.list_checkout_sessions(
    p_merchant_id UUID,
    p_status checkout_session_status DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    checkout_session_id UUID,
    merchant_id UUID,
    organization_id UUID,
    title VARCHAR(255),
    public_description TEXT,
    payment_link_id UUID,
    customer_id UUID,
    product_id UUID,
    subscription_id UUID,
    plan_id UUID,
    amount NUMERIC,
    currency_code currency_code,
    status checkout_session_status,
    metadata JSONB,
    success_url VARCHAR,
    cancel_url VARCHAR,
    customer_email VARCHAR,
    customer_name VARCHAR,
    customer_phone VARCHAR,
    allowed_providers provider_code[],
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cs.checkout_session_id,
        cs.merchant_id,
        cs.organization_id,
        cs.title,
        cs.public_description,
        cs.payment_link_id,
        cs.customer_id,
        cs.product_id,
        cs.subscription_id,
        cs.plan_id,
        cs.amount,
        cs.currency_code,
        cs.status,
        cs.metadata,
        cs.success_url,
        cs.cancel_url,
        cs.customer_email,
        cs.customer_name,
        cs.customer_phone,
        cs.allowed_providers,
        cs.created_at,
        cs.updated_at,
        cs.expires_at
    FROM
        checkout_sessions cs
    WHERE
        cs.merchant_id = p_merchant_id
        AND (p_status IS NULL OR cs.status = p_status)
    ORDER BY
        cs.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;

    -- Log the listing
    PERFORM public.log_event(
        p_merchant_id := p_merchant_id,
        p_event := 'list_checkout_sessions'::event_type,
        p_details := jsonb_build_object(
            'status_filter', p_status,
            'limit', p_limit,
            'offset', p_offset
        ),
        p_severity := 'NOTICE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- -- Function to get merchant details
-- CREATE OR REPLACE FUNCTION public.get_merchant(
--     p_merchant_id UUID
-- )
-- RETURNS TABLE (
--     merchant_id UUID,
--     name VARCHAR,
--     email VARCHAR,
--     phone_number VARCHAR,
--     organization_id UUID,
--     country VARCHAR,
--     mrr NUMERIC,
--     arr NUMERIC,
--     retry_payment_every INT,
--     total_retries INT,
--     metadata JSONB,
--     created_at TIMESTAMPTZ,
--     updated_at TIMESTAMPTZ,
--     is_deleted BOOLEAN
-- ) AS $$
-- BEGIN
--     RETURN QUERY
--     SELECT
--         m.merchant_id,
--         m.name,
--         m.email,
--         m.phone_number,
--         mo.organization_id,
--         m.country,
--         m.mrr,
--         m.arr,
--         m.retry_payment_every,
--         m.total_retries,
--         m.metadata,
--         m.created_at,
--         m.updated_at,
--         m.is_deleted
--     FROM
--         merchants m
--     JOIN
--         merchant_organization_links mo ON m.merchant_id = mo.merchant_id
--     WHERE
--         m.merchant_id = p_merchant_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to get merchant connected providers
CREATE OR REPLACE FUNCTION public.get_merchant_providers(
    p_merchant_id UUID
)
RETURNS TABLE (
    provider_code provider_code,
    name VARCHAR,
    description TEXT,
    is_connected BOOLEAN,
    provider_merchant_id VARCHAR,
    provider_business_type provider_business_type,
    phone_number VARCHAR,
    is_phone_verified BOOLEAN,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.code AS provider_code,
        p.name,
        p.description,
        ops.is_connected,
        ops.provider_merchant_id,
        ops.provider_business_type,
        ops.phone_number,
        ops.is_phone_verified,
        ops.metadata,
        ops.created_at,
        ops.updated_at
    FROM
        providers p
    JOIN
        organization_providers_settings ops ON p.code = ops.provider_code
    JOIN
        merchants m ON m.merchant_id = p_merchant_id
    JOIN
        merchant_organization_links mol ON mol.merchant_id = m.merchant_id AND mol.organization_id = ops.organization_id
    WHERE
        m.merchant_id = p_merchant_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Add a get_customer function to match the API calls
CREATE OR REPLACE FUNCTION public.get_customer(
    p_customer_id UUID,
    p_merchant_id UUID
)
RETURNS TABLE (
    customer_id UUID,
    name VARCHAR,
    email VARCHAR,
    phone_number VARCHAR,
    whatsapp_number VARCHAR,
    country VARCHAR,
    city VARCHAR,
    address VARCHAR,
    postal_code VARCHAR,
    is_business BOOLEAN,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.customer_id,
        c.name,
        c.email,
        c.phone_number,
        c.whatsapp_number,
        c.country,
        c.city,
        c.address,
        c.postal_code,
        c.is_business,
        c.metadata,
        c.created_at,
        c.updated_at
    FROM
        public.customers c
    WHERE
        c.customer_id = p_customer_id
        AND c.merchant_id = p_merchant_id
        AND c.is_deleted = false;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to list customers for a merchant
CREATE OR REPLACE FUNCTION public.list_customers(
    p_merchant_id UUID,
    p_email VARCHAR DEFAULT NULL,
    p_phone_number VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    customer_id UUID,
    name VARCHAR,
    email VARCHAR,
    phone_number VARCHAR,
    whatsapp_number VARCHAR,
    country VARCHAR,
    city VARCHAR,
    address VARCHAR,
    postal_code VARCHAR,
    is_business BOOLEAN,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.customer_id,
        c.name,
        c.email,
        c.phone_number,
        c.whatsapp_number,
        c.country,
        c.city,
        c.address,
        c.postal_code,
        c.is_business,
        c.metadata,
        c.created_at,
        c.updated_at
    FROM
        public.customers c
    WHERE
        c.merchant_id = p_merchant_id
        AND (p_email IS NULL OR c.email = p_email)
        AND (p_phone_number IS NULL OR c.phone_number = p_phone_number)
        AND c.is_deleted = false
    ORDER BY
        c.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to update customer details -- already exists in 20240828000022_functions_customers.sql
-- Here for reference
-- CREATE OR REPLACE FUNCTION public.update_customer(
--     p_customer_id UUID,
--     p_name VARCHAR,
--     p_email VARCHAR,
--     p_phone_number VARCHAR,
--     p_whatsapp_number VARCHAR,
--     p_country VARCHAR,
--     p_city VARCHAR,
--     p_address VARCHAR,
--     p_postal_code VARCHAR,
--     p_is_business BOOLEAN
-- )
-- RETURNS VOID AS $$
-- BEGIN
--     UPDATE customers
--     SET
--         name = p_name,
--         email = p_email,
--         phone_number = p_phone_number,
--         whatsapp_number = p_whatsapp_number,
--         country = p_country,
--         city = p_city,
--         address = p_address,
--         postal_code = p_postal_code,
--         is_business = p_is_business,
--         updated_at = NOW()
--     WHERE customer_id = p_customer_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to delete a customer -- already exists in 20240828000022_functions_customers.sql
-- Here for reference
-- CREATE OR REPLACE FUNCTION public.delete_customer(
--     p_customer_id UUID
-- )
-- RETURNS VOID AS $$
-- BEGIN
--     UPDATE customers
--     SET
--         is_deleted = true,
--         deleted_at = NOW()
--     WHERE
--         customer_id = p_customer_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to create a new customer -- already exists in 20240828000022_functions_customers.sql
-- Here for reference
-- CREATE OR REPLACE FUNCTION public.create_customer(
--     p_merchant_id UUID,
--     p_organization_id UUID,
--     p_name VARCHAR,
--     p_email VARCHAR,
--     p_phone_number VARCHAR,
--     p_whatsapp_number VARCHAR,
--     p_country VARCHAR,
--     p_city VARCHAR,
--     p_address VARCHAR,
--     p_postal_code VARCHAR,
--     p_is_business BOOLEAN
-- )
-- RETURNS UUID AS $$
-- DECLARE
--     v_customer_id UUID;
-- BEGIN
--     INSERT INTO customers (
--         merchant_id,
--         organization_id,
--         name,
--         email,
--         phone_number,
--         whatsapp_number,
--         country,
--         city,
--         address,
--         postal_code,
--         is_business
--     )
--     VALUES (
--         p_merchant_id,
--         p_organization_id,
--         p_name,
--         p_email,
--         p_phone_number,
--         p_whatsapp_number,
--         p_country,
--         p_city,
--         p_address,
--         p_postal_code,
--         p_is_business
--     )
--     RETURNING customer_id INTO v_customer_id;

--     RETURN v_customer_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to list available payment providers
CREATE OR REPLACE FUNCTION public.list_providers(
    p_merchant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    code provider_code,
    name VARCHAR,
    description TEXT,
    payment_methods payment_method_code[],
    is_connected BOOLEAN
) AS $$
DECLARE
    v_organization_id UUID;
BEGIN
    -- Get the organization ID for the merchant if provided
    IF p_merchant_id IS NOT NULL THEN
        SELECT organization_id INTO v_organization_id
        FROM merchant_organization_links
        WHERE merchant_id = p_merchant_id;
    END IF;

    IF p_merchant_id IS NULL OR v_organization_id IS NULL THEN
        -- If no merchant ID provided or no organization found, return all providers with connection status false
        RETURN QUERY
        SELECT
            p.code,
            p.name,
            p.description,
            ARRAY[]::payment_method_code[] AS payment_methods,
            FALSE AS is_connected
        FROM
            providers p
        ORDER BY
            p.name;
    ELSE
        -- Return providers with their connection status for this organization
        RETURN QUERY
        SELECT
            p.code,
            p.name,
            p.description,
            ARRAY[]::payment_method_code[] AS payment_methods,
            COALESCE(ops.is_connected, FALSE) AS is_connected
        FROM
            providers p
        LEFT JOIN
            organization_providers_settings ops ON p.code = ops.provider_code AND ops.organization_id = v_organization_id
        ORDER BY
            p.name;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to create a product -- already exists in 20240828000025_functions_products;
-- Here for reference
-- CREATE OR REPLACE FUNCTION public.create_product(
--     p_merchant_id UUID,
--     p_organization_id UUID,
--     p_name VARCHAR(255),
--     p_description TEXT,
--     p_price NUMERIC(10,2),
--     p_currency_code currency_code,
--     p_image_url TEXT DEFAULT NULL,
--     p_is_active BOOLEAN DEFAULT true,
--     p_display_on_storefront BOOLEAN DEFAULT true,
--     p_fee_type_ids UUID[] DEFAULT NULL
-- )
-- RETURNS UUID AS $$
-- DECLARE
--     v_product_id UUID;
-- BEGIN
--     -- Create the product
--     INSERT INTO merchant_products (
--         merchant_id,
--         organization_id,
--         name,
--         description,
--         price,
--         currency_code,
--         image_url,
--         is_active,
--         display_on_storefront
--     )
--     VALUES (
--         p_merchant_id,
--         p_organization_id,
--         p_name,
--         p_description,
--         p_price,
--         p_currency_code,
--         p_image_url,
--         p_is_active,
--         p_display_on_storefront
--     )
--     RETURNING product_id INTO v_product_id;

--     -- Create fee links if fees are provided
--     IF p_fee_type_ids IS NOT NULL AND array_length(p_fee_type_ids, 1) > 0 THEN
--         INSERT INTO organization_fee_links (
--             organization_id,
--             fee_type_id,
--             product_id
--         )
--         SELECT
--             p_organization_id,
--             fee_id,
--             v_product_id
--         FROM unnest(p_fee_type_ids) AS fee_id;
--     END IF;

--     -- Log product creation
--     PERFORM public.log_event(
--         p_merchant_id := p_merchant_id,
--         p_event := 'create_product'::event_type,
--         p_details := jsonb_build_object(
--             'product_id', v_product_id,
--             'name', p_name,
--             'price', p_price,
--             'currency', p_currency_code,
--             'has_image', p_image_url IS NOT NULL,
--             'display_on_storefront', p_display_on_storefront,
--             'fee_count', array_length(p_fee_type_ids, 1)
--         ),
--         p_severity := 'NOTICE'
--     );

--     RETURN v_product_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to get product details
CREATE OR REPLACE FUNCTION public.get_product(
    p_product_id UUID,
    p_merchant_id UUID
)
RETURNS TABLE (
    product_id UUID,
    merchant_id UUID,
    organization_id UUID,
    name VARCHAR,
    description TEXT,
    price NUMERIC(15,2),
    currency_code currency_code,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mp.product_id,
        mp.merchant_id,
        mp.organization_id,
        mp.name,
        mp.description,
        mp.price,
        mp.currency_code,
        mp.is_active,
        mp.created_at,
        mp.updated_at
    FROM
        public.merchant_products mp
    WHERE
        mp.product_id = p_product_id
        AND mp.merchant_id = p_merchant_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to list products for a merchant
CREATE OR REPLACE FUNCTION public.list_products(
    p_merchant_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    product_id UUID,
    merchant_id UUID,
    organization_id UUID,
    name VARCHAR,
    description TEXT,
    price NUMERIC(15,2),
    currency_code currency_code,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mp.product_id,
        mp.merchant_id,
        mp.organization_id,
        mp.name,
        mp.description,
        mp.price,
        mp.currency_code,
        mp.is_active,
        mp.created_at,
        mp.updated_at
    FROM
        merchant_products mp
    WHERE
        mp.merchant_id = p_merchant_id
    ORDER BY
        mp.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to update product details -- already exists in 20240828000025_functions_products;
-- Here for reference
-- CREATE OR REPLACE FUNCTION public.update_product(
--     p_product_id UUID,
--     p_name VARCHAR(255),
--     p_description TEXT,
--     p_price NUMERIC(10,2),
--     p_image_url TEXT,
--     p_is_active BOOLEAN,
--     p_display_on_storefront BOOLEAN,
--     p_fee_type_ids UUID[] DEFAULT NULL
-- )
-- RETURNS VOID AS $$
-- DECLARE
--     v_merchant_id UUID;
--     v_organization_id UUID;
--     v_old_price NUMERIC;
--     v_currency currency_code;
--     v_old_image_url TEXT;
-- BEGIN
--     -- Get current product details
--     SELECT
--         merchant_id,
--         organization_id,
--         price,
--         currency_code,
--         image_url
--     INTO
--         v_merchant_id,
--         v_organization_id,
--         v_old_price,
--         v_currency,
--         v_old_image_url
--     FROM merchant_products
--     WHERE product_id = p_product_id;

--     -- Update product details
--     UPDATE merchant_products
--     SET
--         name = COALESCE(p_name, name),
--         description = p_description,
--         price = COALESCE(p_price, price),
--         image_url = p_image_url,
--         is_active = COALESCE(p_is_active, is_active),
--         display_on_storefront = COALESCE(p_display_on_storefront, display_on_storefront),
--         updated_at = NOW()
--     WHERE product_id = p_product_id;

--     -- Update fees if provided
--     IF p_fee_type_ids IS NOT NULL THEN
--         -- Delete existing fee links
--         DELETE FROM organization_fee_links
--         WHERE product_id = p_product_id;

--         -- Insert new fee links
--         IF array_length(p_fee_type_ids, 1) > 0 THEN
--             INSERT INTO organization_fee_links (
--                 organization_id,
--                 fee_type_id,
--                 product_id
--             )
--             SELECT
--                 v_organization_id,
--                 fee_id,
--                 p_product_id
--             FROM unnest(p_fee_type_ids) AS fee_id;
--         END IF;
--     END IF;

--     -- Log product update
--     PERFORM public.log_event(
--         p_merchant_id := v_merchant_id,
--         p_event := 'update_product'::event_type,
--         p_details := jsonb_build_object(
--             'product_id', p_product_id,
--             'name', p_name,
--             'old_price', v_old_price,
--             'new_price', p_price,
--             'currency', v_currency,
--             'is_active', p_is_active,
--             'old_image_url', v_old_image_url,
--             'new_image_url', p_image_url,
--             'image_changed', (v_old_image_url IS DISTINCT FROM p_image_url),
--             'display_on_storefront', p_display_on_storefront,
--             'fee_count', array_length(p_fee_type_ids, 1)
--         ),
--         p_severity := 'NOTICE'
--     );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Functions to create  a transactions -- already exists in 20240828000046_functions_checkout_transaction;
-- Here for reference
-- CREATE OR REPLACE FUNCTION create_transaction(
--     p_merchant_id UUID,
--     p_organization_id UUID,
--     p_customer_id UUID,
--     p_amount NUMERIC,
--     p_currency_code currency_code,
--     p_provider_code provider_code,
--     p_payment_method_code payment_method_code,
--     p_description TEXT DEFAULT NULL,
--     p_product_id UUID DEFAULT NULL,
--     p_subscription_id UUID DEFAULT NULL,
--     p_metadata JSONB DEFAULT NULL
-- ) RETURNS UUID AS $$
-- DECLARE
--     v_transaction_id UUID;
--     v_fee_data RECORD;
--     v_fee_amount NUMERIC;
--     v_net_amount NUMERIC;
--     v_fee_name TEXT;
--     v_transaction_type transaction_type;
-- BEGIN
--     -- Get fee calculation based on provider and payment method
--     SELECT name, percentage, fixed_amount
--     FROM get_transaction_fee(
--         'payment'::transaction_type,
--         p_provider_code,
--         p_payment_method_code,
--         p_currency_code
--     ) INTO v_fee_data;

--     -- Calculate fee and net amounts
--     v_fee_amount := (p_amount * v_fee_data.percentage / 100) + v_fee_data.fixed_amount;
--     v_net_amount := p_amount - v_fee_amount;
--     v_fee_name := v_fee_data.name;

--     -- Determine the transaction type based on whether it's a subscription payment
--     v_transaction_type := CASE
--         WHEN p_subscription_id IS NOT NULL THEN 'instalment'::transaction_type
--         ELSE 'payment'::transaction_type
--     END;

--     -- Insert transaction
--     INSERT INTO transactions (
--         merchant_id,
--         organization_id,
--         customer_id,
--         product_id,
--         subscription_id,
--         transaction_type,
--         description,
--         metadata,
--         gross_amount,
--         fee_amount,
--         net_amount,
--         fee_reference,
--         currency_code,
--         provider_code,
--         payment_method_code
--     ) VALUES (
--         p_merchant_id,
--         p_organization_id,
--         p_customer_id,
--         p_product_id,
--         p_subscription_id,
--         v_transaction_type,
--         p_description,
--         p_metadata,
--         p_amount,
--         v_fee_amount,
--         v_net_amount,
--         v_fee_name,
--         p_currency_code,
--         p_provider_code,
--         p_payment_method_code
--     ) RETURNING transaction_id INTO v_transaction_id;

--     RETURN v_transaction_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to update a transaction -- already exists in 20240828000046_functions_checkout_transaction;
-- Here for reference
-- CREATE OR REPLACE FUNCTION simple_update_transaction_status(
--     p_transaction_id UUID,
--     p_status transaction_status,
--     p_metadata JSONB DEFAULT NULL
-- ) RETURNS BOOLEAN AS $$
-- DECLARE
--     v_transaction RECORD;
-- BEGIN
--     -- Get transaction details
--     SELECT * FROM transactions
--     WHERE transaction_id = p_transaction_id
--     INTO v_transaction;

--     IF NOT FOUND THEN
--         RAISE EXCEPTION 'Transaction not found';
--     END IF;

--     -- Update transaction status
--     UPDATE transactions
--     SET
--         status = p_status,
--         metadata = COALESCE(p_metadata, metadata),
--         updated_at = NOW()
--     WHERE transaction_id = p_transaction_id;

--     -- If transaction is completed, update all balances
--     IF p_status = 'completed' THEN
--         -- 1. Update platform main account (our fee revenue)
--         INSERT INTO platform_main_account (
--             total_balance,
--             available_balance,
--             currency_code
--         ) VALUES (
--             v_transaction.fee_amount,
--             v_transaction.fee_amount,
--             v_transaction.currency_code
--         )
--         ON CONFLICT (currency_code) DO UPDATE
--         SET
--             total_balance = platform_main_account.total_balance + v_transaction.fee_amount,
--             available_balance = platform_main_account.available_balance + v_transaction.fee_amount,
--             updated_at = NOW();

--         -- 2. Update merchant account (what they receive)
--         INSERT INTO merchant_accounts (
--             merchant_id,
--             organization_id,
--             balance,
--             currency_code
--         ) VALUES (
--             v_transaction.merchant_id,
--             v_transaction.organization_id,
--             v_transaction.net_amount,
--             v_transaction.currency_code
--         )
--         ON CONFLICT (organization_id, currency_code) DO UPDATE
--         SET
--             balance = merchant_accounts.balance + v_transaction.net_amount;

--         -- 3. Update provider balance (what they hold)
--         INSERT INTO platform_provider_balance (
--             provider_code,
--             current_balance,
--             currency_code,
--             quarter_start_date,
--             total_transactions_amount,
--             provider_fees,
--             platform_revenue
--         ) VALUES (
--             v_transaction.provider_code,
--             v_transaction.gross_amount,
--             v_transaction.currency_code,
--             date_trunc('quarter', CURRENT_DATE),
--             v_transaction.gross_amount,
--             0, -- No provider fees tracked here
--             v_transaction.fee_amount
--         )
--         ON CONFLICT (provider_code, currency_code, quarter_start_date) DO UPDATE
--         SET
--             current_balance = platform_provider_balance.current_balance + v_transaction.gross_amount,
--             total_transactions_amount = platform_provider_balance.total_transactions_amount + v_transaction.gross_amount,
--             platform_revenue = platform_provider_balance.platform_revenue + v_transaction.fee_amount,
--             updated_at = NOW();
--     END IF;

--     RETURN TRUE;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to list transactions
CREATE OR REPLACE FUNCTION public.list_transactions(
    p_merchant_id UUID,
    p_status transaction_status[] DEFAULT NULL,
    p_provider provider_code DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    transaction_id UUID,
    merchant_id UUID,
    organization_id UUID,
    customer_id UUID,
    gross_amount NUMERIC,
    fee_amount NUMERIC,
    net_amount NUMERIC,
    fee_reference TEXT,
    currency_code currency_code,
    payment_method_code payment_method_code,
    provider_code provider_code,
    provider_transaction_id VARCHAR,
    transaction_type transaction_type,
    product_id UUID,
    subscription_id UUID,
    description TEXT,
    metadata JSONB,
    status transaction_status,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.transaction_id,
        t.merchant_id,
        t.organization_id,
        t.customer_id,
        t.gross_amount,
        t.fee_amount,
        t.net_amount,
        t.fee_reference,
        t.currency_code,
        t.payment_method_code,
        t.provider_code,
        pt.provider_transaction_id,
        t.transaction_type,
        t.product_id,
        t.subscription_id,
        t.description,
        t.metadata,
        t.status,
        t.created_at,
        t.updated_at
    FROM
        public.transactions t
    LEFT JOIN
        public.providers_transactions pt ON t.transaction_id = pt.transaction_id
    WHERE
        t.merchant_id = p_merchant_id
        AND (p_status IS NULL OR t.status = ANY(p_status))
        AND (p_provider IS NULL OR t.provider_code = p_provider)
        AND (p_start_date IS NULL OR t.created_at >= p_start_date)
        AND (p_end_date IS NULL OR t.created_at <= p_end_date)
    ORDER BY
        t.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Function to create refund -- already exists in 20240828000046_functions_checkout_transaction.sql;
-- Here for reference
-- CREATE OR REPLACE FUNCTION public.create_refund(
--     p_merchant_id UUID,
--     p_transaction_id UUID,
--     p_amount NUMERIC,
--     p_reason TEXT DEFAULT NULL,
--     p_provider_transaction_id VARCHAR DEFAULT NULL,
--     p_provider_merchant_id VARCHAR DEFAULT NULL,
--     p_provider_code provider_code DEFAULT NULL,
--     p_metadata JSONB DEFAULT NULL
-- )
-- RETURNS UUID AS $$
-- DECLARE
--     v_refund_id UUID;
--     v_transaction_amount NUMERIC;
--     v_fee_amount NUMERIC;
--     v_new_status transaction_status;
-- BEGIN
--     -- Get original transaction amount
--     SELECT gross_amount, fee_amount
--     INTO v_transaction_amount, v_fee_amount
--     FROM transactions
--     WHERE transaction_id = p_transaction_id;

--     -- Determine new transaction status based on refund amount
--     IF p_amount >= v_transaction_amount THEN
--         v_new_status := 'refunded';
--     ELSE
--         v_new_status := 'partially_refunded';
--     END IF;

--     -- Create refund record
--     INSERT INTO refunds (
--         transaction_id,
--         amount,
--         refunded_amount,
--         fee_amount,
--         reason,
--         provider_transaction_id,
--         metadata,
--         status
--     ) VALUES (
--         p_transaction_id,
--         v_transaction_amount,
--         p_amount,
--         v_fee_amount,
--         p_reason,
--         p_provider_transaction_id,
--         jsonb_build_object(
--             'provider_transaction_id', p_provider_transaction_id,
--             'provider_merchant_id', p_provider_merchant_id,
--             'provider_code', p_provider_code,
--             'refunded_by', 'merchant',
--             'additional_data', p_metadata
--         ),
--         'completed'
--     ) RETURNING refund_id INTO v_refund_id;

--     -- Update transaction status
--     UPDATE transactions
--     SET status = v_new_status
--     WHERE transaction_id = p_transaction_id;

--     -- Update provider transaction status if applicable
--     IF p_provider_transaction_id IS NOT NULL THEN
--         UPDATE providers_transactions
--         SET provider_payment_status = v_new_status
--         WHERE transaction_id = p_transaction_id;
--     END IF;

--     -- Log refund creation
--     PERFORM public.log_event(
--         p_merchant_id := p_merchant_id,
--         p_event := 'create_refund'::event_type,
--         p_details := jsonb_build_object(
--             'refund_id', v_refund_id,
--             'transaction_id', p_transaction_id,
--             'amount', p_amount,
--             'provider_transaction_id', p_provider_transaction_id,
--             'provider_merchant_id', p_provider_merchant_id,
--             'reason', p_reason
--         ),
--         p_severity := 'CRITICAL'
--     );

--     RETURN v_refund_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to get refund details
CREATE OR REPLACE FUNCTION public.get_refund(
    p_refund_id UUID,
    p_merchant_id UUID
)
RETURNS TABLE (
    refund_id UUID,
    transaction_id UUID,
    amount NUMERIC,
    refunded_amount NUMERIC,
    fee_amount NUMERIC,
    reason TEXT,
    status refund_status,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_transaction_id UUID;
BEGIN
    -- First get the transaction_id to check merchant ownership
    SELECT r.transaction_id INTO v_transaction_id
    FROM refunds r
    WHERE r.refund_id = p_refund_id;

    -- Only return the refund if it belongs to the merchant
    RETURN QUERY
    SELECT
        r.refund_id,
        r.transaction_id,
        r.amount,
        r.refunded_amount,
        r.fee_amount,
        r.reason,
        r.status,
        r.metadata,
        r.created_at,
        r.updated_at
    FROM
        refunds r
    JOIN
        transactions t ON r.transaction_id = t.transaction_id
    WHERE
        r.refund_id = p_refund_id
        AND t.merchant_id = p_merchant_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to update refund status
CREATE OR REPLACE FUNCTION public.update_refund_status(
    p_refund_id UUID,
    p_merchant_id UUID,
    p_status refund_status
)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated BOOLEAN := FALSE;
BEGIN
    UPDATE refunds
    SET
        status = p_status,
        updated_at = NOW()
    WHERE
        refund_id = p_refund_id
        AND merchant_id = p_merchant_id
    RETURNING TRUE INTO v_updated;

    -- Log the update if successful
    IF v_updated THEN
        PERFORM public.log_event(
            p_merchant_id := p_merchant_id,
            p_event := 'update_refund'::event_type,
            p_details := jsonb_build_object(
                'refund_id', p_refund_id,
                'status', p_status
            ),
            p_severity := 'NOTICE'
        );
    END IF;

    RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to create subscription plan -- already exists in 20240828000024_functions_subscriptions.sql;
-- Here for reference
-- CREATE OR REPLACE FUNCTION public.create_subscription_plan(
--     p_merchant_id UUID,
--     p_organization_id UUID,
--     p_name VARCHAR,
--     p_description TEXT,
--     p_billing_frequency frequency,
--     p_amount NUMERIC,
--     p_currency_code currency_code DEFAULT 'XOF',
--     p_failed_payment_action failed_payment_action DEFAULT 'continue',
--     p_charge_day INT DEFAULT NULL,
--     p_metadata JSONB DEFAULT '{}'::jsonb,
--     p_first_payment_type first_payment_type DEFAULT 'initial',
--     p_display_on_storefront BOOLEAN DEFAULT true,
--     p_image_url TEXT DEFAULT NULL
-- )
-- RETURNS UUID AS $$
-- DECLARE
--     v_plan_id UUID;
--     v_metadata JSONB;
-- BEGIN
--     -- Add display_on_storefront to metadata
--     v_metadata := COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('display_on_storefront', p_display_on_storefront);

--     INSERT INTO subscription_plans (
--         merchant_id, organization_id, name, description, billing_frequency, amount, currency_code,
--         failed_payment_action, charge_day, metadata, first_payment_type, image_url
--     )
--     VALUES (
--         p_merchant_id, p_organization_id, p_name, p_description, p_billing_frequency, p_amount, p_currency_code,
--         p_failed_payment_action, CASE WHEN p_metadata->>'subscription_length' = 'automatic' THEN NULL ELSE p_charge_day END,
--         v_metadata, p_first_payment_type, p_image_url
--     )
--     RETURNING plan_id INTO v_plan_id;

--     RETURN v_plan_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to get subscription plan details
CREATE OR REPLACE FUNCTION public.get_subscription_plan(
    p_plan_id UUID,
    p_merchant_id UUID
)
RETURNS TABLE (
    plan_id UUID,
    merchant_id UUID,
    organization_id UUID,
    name VARCHAR,
    description TEXT,
    amount NUMERIC,
    currency_code currency_code,
    billing_frequency frequency,
    failed_payment_action failed_payment_action,
    charge_day INT,
    metadata JSONB,
    is_active BOOLEAN,
    first_payment_type first_payment_type,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.plan_id,
        sp.merchant_id,
        sp.organization_id,
        sp.name,
        sp.description,
        sp.amount,
        sp.currency_code,
        sp.billing_frequency,
        sp.failed_payment_action,
        sp.charge_day,
        sp.metadata,
        sp.is_active,
        sp.first_payment_type,
        sp.created_at,
        sp.updated_at
    FROM
        subscription_plans sp
    WHERE
        sp.plan_id = p_plan_id
        AND sp.merchant_id = p_merchant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public, pg_temp';

-- Function to list subscription plans
CREATE OR REPLACE FUNCTION public.list_subscription_plans(
    p_merchant_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    plan_id UUID,
    merchant_id UUID,
    organization_id UUID,
    name VARCHAR,
    description TEXT,
    amount NUMERIC,
    currency_code currency_code,
    billing_frequency frequency,
    failed_payment_action failed_payment_action,
    charge_day INT,
    metadata JSONB,
    is_active BOOLEAN,
    first_payment_type first_payment_type,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.plan_id,
        sp.merchant_id,
        sp.organization_id,
        sp.name,
        sp.description,
        sp.amount,
        sp.currency_code,
        sp.billing_frequency,
        sp.failed_payment_action,
        sp.charge_day,
        sp.metadata,
        sp.is_active,
        sp.first_payment_type,
        sp.created_at,
        sp.updated_at
    FROM
        subscription_plans sp
    WHERE
        sp.merchant_id = p_merchant_id
    ORDER BY
        sp.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = 'public, pg_temp';

-- Function to update subscription plan -- already exists in 20240828000024_functions_subscriptions.sql;
-- Here for reference
-- CREATE OR REPLACE FUNCTION public.update_subscription_plan(
--     p_plan_id UUID,
--     p_name VARCHAR,
--     p_description TEXT,
--     p_billing_frequency frequency,
--     p_amount NUMERIC,
--     p_failed_payment_action failed_payment_action,
--     p_charge_day INT,
--     p_metadata JSONB,
--     p_display_on_storefront BOOLEAN DEFAULT NULL,
--     p_image_url TEXT DEFAULT NULL,
--     p_is_active BOOLEAN DEFAULT NULL
-- )
-- RETURNS VOID AS $$
-- DECLARE
--     v_metadata JSONB;
--     v_old_image_url TEXT;
-- BEGIN
--     -- Get current metadata and image_url
--     SELECT metadata, image_url
--     INTO v_metadata, v_old_image_url
--     FROM subscription_plans
--     WHERE plan_id = p_plan_id;

--     -- Update display_on_storefront in metadata if provided
--     IF p_display_on_storefront IS NOT NULL THEN
--         v_metadata := COALESCE(v_metadata, '{}'::jsonb) || jsonb_build_object('display_on_storefront', p_display_on_storefront);
--     END IF;

--     -- Merge with new metadata if provided
--     IF p_metadata IS NOT NULL THEN
--         v_metadata := COALESCE(v_metadata, '{}'::jsonb) || p_metadata;
--     END IF;

--     UPDATE subscription_plans
--     SET
--         name = COALESCE(p_name, name),
--         description = p_description,
--         billing_frequency = COALESCE(p_billing_frequency, billing_frequency),
--         amount = COALESCE(p_amount, amount),
--         failed_payment_action = COALESCE(p_failed_payment_action, failed_payment_action),
--         charge_day = COALESCE(p_charge_day, charge_day),
--         metadata = v_metadata,
--         image_url = p_image_url,
--         is_active = COALESCE(p_is_active, is_active),
--         updated_at = NOW()
--     WHERE plan_id = p_plan_id;

--     -- Log plan update with image change info
--     PERFORM public.log_event(
--         p_merchant_id := (SELECT merchant_id FROM subscription_plans WHERE plan_id = p_plan_id),
--         p_event := 'update_product'::event_type,
--         p_details := jsonb_build_object(
--             'plan_id', p_plan_id,
--             'name', p_name,
--             'old_image_url', v_old_image_url,
--             'new_image_url', p_image_url,
--             'image_changed', (v_old_image_url IS DISTINCT FROM p_image_url),
--             'display_on_storefront', p_display_on_storefront,
--             'is_active', p_is_active
--         ),
--         p_severity := 'NOTICE'
--     );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- API key functions -- already exists in 20240828000029_functions_api_keys.sql;

-- Function to verify an API key and update usage statistics
CREATE OR REPLACE FUNCTION public.verify_api_key(
    p_api_key VARCHAR,
    p_endpoint VARCHAR,
    p_request_method VARCHAR DEFAULT 'GET',
    p_ip_address VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    is_valid BOOLEAN,
    merchant_id UUID,
    organization_id UUID,
    environment VARCHAR,
    rate_limited BOOLEAN,
    message VARCHAR
) AS $$
DECLARE
    v_merchant_id UUID;
    v_organization_id UUID;
    v_is_active BOOLEAN;
    v_expiration_date TIMESTAMPTZ;
    v_environment VARCHAR;
    v_rate_limited BOOLEAN;
    v_api_usage_exists BOOLEAN;
BEGIN
    -- Check if API key is valid
    SELECT
        ak.merchant_id,
        ak.organization_id,
        ak.is_active,
        ak.expiration_date,
        ak.environment
    INTO
        v_merchant_id,
        v_organization_id,
        v_is_active,
        v_expiration_date,
        v_environment
    FROM api_keys ak
    WHERE ak.api_key = p_api_key;

    -- If API key doesn't exist or is not active
    IF v_merchant_id IS NULL OR NOT v_is_active THEN
        -- Log failed verification
        PERFORM public.log_event(
            p_merchant_id := NULL,
            p_event := 'verify_api_key'::event_type,
            p_details := jsonb_build_object(
                'api_key', substring(p_api_key, 1, 8) || '****',
                'endpoint', p_endpoint,
                'success', false,
                'reason', CASE
                    WHEN v_merchant_id IS NULL THEN 'invalid_key'
                    ELSE 'inactive_key'
                END
            ),
            p_severity := 'WARNING'
        );

        RETURN QUERY SELECT
            false,
            NULL::UUID,
            NULL::UUID,
            NULL::VARCHAR,
            false,
            CASE
                WHEN v_merchant_id IS NULL THEN 'Invalid API key'
                ELSE 'API key is inactive'
            END;
        RETURN;
    END IF;

    -- Check if API key is expired
    IF v_expiration_date IS NOT NULL AND v_expiration_date < NOW() THEN
        -- Log expired key verification
        PERFORM public.log_event(
            p_merchant_id := v_merchant_id,
            p_event := 'verify_api_key'::event_type,
            p_details := jsonb_build_object(
                'api_key', substring(p_api_key, 1, 8) || '****',
                'endpoint', p_endpoint,
                'success', false,
                'reason', 'expired_key'
            ),
            p_severity := 'WARNING'
        );

        RETURN QUERY SELECT
            false,
            v_merchant_id,
            v_organization_id,
            v_environment,
            false,
            'API key has expired';
        RETURN;
    END IF;

    -- Check rate limits
    SELECT * FROM public.check_rate_limit(v_organization_id, p_api_key, p_endpoint) INTO v_rate_limited;

    -- If rate limited
    IF v_rate_limited THEN
        -- Log rate limit exceeded
        PERFORM public.log_event(
            p_merchant_id := v_merchant_id,
            p_event := 'verify_api_key'::event_type,
            p_details := jsonb_build_object(
                'api_key', substring(p_api_key, 1, 8) || '****',
                'endpoint', p_endpoint,
                'success', false,
                'reason', 'rate_limited'
            ),
            p_severity := 'WARNING'
        );

        RETURN QUERY SELECT
            false,
            v_merchant_id,
            v_organization_id,
            v_environment,
            true,
            'Rate limit exceeded';
        RETURN;
    END IF;

    -- Update API usage statistics
    SELECT EXISTS (
        SELECT 1 FROM api_usage
        WHERE organization_id = v_organization_id
        AND api_key = p_api_key
        AND endpoint = p_endpoint
    ) INTO v_api_usage_exists;

    IF v_api_usage_exists THEN
        -- Update existing usage record
        UPDATE api_usage
        SET
            request_count = request_count + 1,
            last_request_at = NOW(),
            request_method = p_request_method,
            ip_address = p_ip_address
        WHERE
            organization_id = v_organization_id
            AND api_key = p_api_key
            AND endpoint = p_endpoint;
    ELSE
        -- Create new usage record
        INSERT INTO api_usage (
            organization_id,
            api_key,
            endpoint,
            request_count,
            last_request_at,
            request_method,
            ip_address
        ) VALUES (
            v_organization_id,
            p_api_key,
            p_endpoint,
            1,
            NOW(),
            p_request_method,
            p_ip_address
        );
    END IF;

    -- Log successful verification
    PERFORM public.log_event(
        p_merchant_id := v_merchant_id,
        p_event := 'verify_api_key'::event_type,
        p_details := jsonb_build_object(
            'api_key', substring(p_api_key, 1, 8) || '****',
            'endpoint', p_endpoint,
            'success', true,
            'environment', v_environment
        ),
        p_severity := 'NOTICE'
    );

    -- Return success
    RETURN QUERY SELECT
        true,
        v_merchant_id,
        v_organization_id,
        v_environment,
        false,
        'API key verified successfully';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';


-- Function to revoke API key
CREATE OR REPLACE FUNCTION public.revoke_api_key(
    p_api_key TEXT,
    p_merchant_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_revoked BOOLEAN := FALSE;
BEGIN
    UPDATE api_keys
    SET
        is_active = FALSE,
        updated_at = NOW()
    WHERE
        api_key = p_api_key
        AND merchant_id = p_merchant_id
    RETURNING TRUE INTO v_revoked;

    -- Log the revocation if successful
    IF v_revoked THEN
        PERFORM public.log_event(
            p_merchant_id := p_merchant_id,
            p_event := 'revoke_api_key'::event_type,
            p_details := jsonb_build_object(
                'api_key', left(p_api_key, 10) || '...'
            ),
            p_severity := 'NOTICE'
        );
    END IF;

    RETURN v_revoked;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to check API rate limits with different limits for test vs live environments
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_organization_id UUID,
    p_api_key VARCHAR,
    p_endpoint VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_request_count INT;
    v_last_request_at TIMESTAMPTZ;
    v_rate_limit_exceeded BOOLEAN := FALSE;
    v_rate_limit_per_minute INT;
    v_rate_limit_per_day INT;
    v_environment VARCHAR;
BEGIN
    -- Get the API key's environment (test or live)
    SELECT environment INTO v_environment
    FROM api_keys
    WHERE api_key = p_api_key;

    -- Set different rate limits based on environment
    IF v_environment = 'test' THEN
        -- Higher limits for test environment
        v_rate_limit_per_minute := 120; -- 2x the regular limit
        v_rate_limit_per_day := 20000;  -- 2x the regular limit
    ELSE
        -- Regular limits for live environment
        v_rate_limit_per_minute := 60;
        v_rate_limit_per_day := 10000;
    END IF;

    -- Get current usage statistics
    SELECT request_count, last_request_at
    INTO v_request_count, v_last_request_at
    FROM api_usage
    WHERE organization_id = p_organization_id
    AND api_key = p_api_key
    AND endpoint = p_endpoint;

    -- If no record exists yet, not rate limited
    IF v_request_count IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check minute-based rate limit
    IF v_last_request_at > NOW() - INTERVAL '1 minute' THEN
        -- Get count of requests in the last minute
        SELECT COUNT(*)
        INTO v_request_count
        FROM api_usage
        WHERE organization_id = p_organization_id
        AND api_key = p_api_key
        AND endpoint = p_endpoint
        AND last_request_at > NOW() - INTERVAL '1 minute';

        IF v_request_count >= v_rate_limit_per_minute THEN
            v_rate_limit_exceeded := TRUE;

            -- Log rate limit exceeded
            PERFORM public.log_api_error(
                'RATE_LIMIT_EXCEEDED',
                'Rate limit exceeded for endpoint: ' || p_endpoint,
                NULL,
                jsonb_build_object(
                    'api_key', substring(p_api_key, 1, 8) || '****',
                    'organization_id', p_organization_id,
                    'endpoint', p_endpoint,
                    'request_count', v_request_count,
                    'limit_period', 'minute',
                    'limit', v_rate_limit_per_minute,
                    'environment', v_environment
                )
            );
        END IF;
    END IF;

    -- Check day-based rate limit
    IF NOT v_rate_limit_exceeded THEN
        -- Get count of requests in the last day
        SELECT COUNT(*)
        INTO v_request_count
        FROM api_usage
        WHERE organization_id = p_organization_id
        AND api_key = p_api_key
        AND last_request_at > NOW() - INTERVAL '1 day';

        IF v_request_count >= v_rate_limit_per_day THEN
            v_rate_limit_exceeded := TRUE;

            -- Log rate limit exceeded
            PERFORM public.log_api_error(
                'RATE_LIMIT_EXCEEDED',
                'Daily rate limit exceeded',
                NULL,
                jsonb_build_object(
                    'api_key', substring(p_api_key, 1, 8) || '****',
                    'organization_id', p_organization_id,
                    'endpoint', p_endpoint,
                    'request_count', v_request_count,
                    'limit_period', 'day',
                    'limit', v_rate_limit_per_day,
                    'environment', v_environment
                )
            );
        END IF;
    END IF;

    RETURN v_rate_limit_exceeded;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to log API errors
CREATE OR REPLACE FUNCTION public.log_api_error(
    p_error_type VARCHAR,
    p_error_message TEXT,
    p_stack_trace TEXT DEFAULT NULL,
    p_context JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
    v_error_id UUID;
BEGIN
    INSERT INTO api_error_logs (
        error_type,
        error_message,
        stack_trace,
        context,
        created_at
    ) VALUES (
        p_error_type,
        p_error_message,
        p_stack_trace,
        p_context,
        NOW()
    )
    RETURNING error_id INTO v_error_id;

    RETURN v_error_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to ping the API
CREATE OR REPLACE FUNCTION public.ping_api()
RETURNS TEXT AS $$
BEGIN
    RETURN 'pong';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Here for reference
-- -- Function to create a new product
-- CREATE OR REPLACE FUNCTION public.create_product(
--     p_merchant_id UUID,
--     p_organization_id UUID,
--     p_name VARCHAR(255),
--     p_description TEXT,
--     p_price NUMERIC(10,2),
--     p_currency_code currency_code,
--     p_is_active BOOLEAN DEFAULT true
-- )
-- RETURNS UUID AS $$
-- DECLARE
--     v_product_id UUID;
-- BEGIN
--     INSERT INTO merchant_products (
--         merchant_id,
--         organization_id,
--         name,
--         description,
--         price,
--         currency_code,
--         is_active
--     )
--     VALUES (
--         p_merchant_id,
--         p_organization_id,
--         p_name,
--         p_description,
--         p_price,
--         p_currency_code,
--         p_is_active
--     )
--     RETURNING product_id INTO v_product_id;

--     RETURN v_product_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- -- Function to get a product
-- CREATE OR REPLACE FUNCTION public.get_product(
--     p_product_id UUID,
--     p_merchant_id UUID
-- )
-- RETURNS SETOF merchant_products AS $$
-- BEGIN
--     RETURN QUERY
--     SELECT *
--     FROM merchant_products
--     WHERE product_id = p_product_id
--     AND merchant_id = p_merchant_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- -- Function to list products for a merchant
-- CREATE OR REPLACE FUNCTION public.list_products(
--     p_merchant_id UUID,
--     p_limit INTEGER DEFAULT 20,
--     p_offset INTEGER DEFAULT 0
-- )
-- RETURNS SETOF merchant_products AS $$
-- BEGIN
--     RETURN QUERY
--     SELECT *
--     FROM merchant_products
--     WHERE merchant_id = p_merchant_id
--     ORDER BY created_at DESC
--     LIMIT p_limit
--     OFFSET p_offset;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- -- Function to update a product
-- CREATE OR REPLACE FUNCTION public.update_product(
--     p_product_id UUID,
--     p_name VARCHAR(255) DEFAULT NULL,
--     p_description TEXT DEFAULT NULL,
--     p_price NUMERIC(10,2) DEFAULT NULL,
--     p_currency_code currency_code DEFAULT NULL,
--     p_is_active BOOLEAN DEFAULT NULL
-- )
-- RETURNS BOOLEAN AS $$
-- BEGIN
--     UPDATE merchant_products
--     SET
--         name = COALESCE(p_name, name),
--         description = COALESCE(p_description, description),
--         price = COALESCE(p_price, price),
--         currency_code = COALESCE(p_currency_code, currency_code),
--         is_active = COALESCE(p_is_active, is_active),
--         updated_at = NOW()
--     WHERE product_id = p_product_id;

--     RETURN FOUND;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Here for reference
-- -- Function to delete a product
-- CREATE OR REPLACE FUNCTION public.delete_product(
--     p_product_id UUID
-- )
-- RETURNS BOOLEAN AS $$
-- BEGIN
--     DELETE FROM merchant_products
--     WHERE product_id = p_product_id;

--     RETURN FOUND;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- -- Grant execute permission to authenticated users
-- GRANT EXECUTE ON FUNCTION public.create_product(UUID, UUID, VARCHAR, TEXT, NUMERIC, currency_code, BOOLEAN) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_product(UUID, UUID) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.list_products(UUID, INTEGER, INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.update_product(UUID, VARCHAR, TEXT, NUMERIC, currency_code, BOOLEAN) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.delete_product(UUID) TO authenticated;

-- Here for reference
-- -- Function to fetch payment links for a specific merchant
-- CREATE OR REPLACE FUNCTION public.fetch_payment_links(
--     p_merchant_id UUID,
--     p_organization_id UUID DEFAULT NULL,
--     p_link_type link_type DEFAULT NULL,
--     p_currency_code currency_code DEFAULT NULL,
--     p_is_active BOOLEAN DEFAULT NULL,
--     p_page INTEGER DEFAULT 1,
--     p_page_size INTEGER DEFAULT 50,
--     p_include_expired BOOLEAN DEFAULT false
-- )
-- RETURNS TABLE (
--     link_id UUID,
--     merchant_id UUID,
--     organization_id UUID,
--     link_type link_type,
--     url VARCHAR(2048),
--     product_id UUID,
--     product_name VARCHAR(255),
--     product_price NUMERIC(10,2),
--     plan_id UUID,
--     plan_name VARCHAR(255),
--     plan_amount NUMERIC(10,2),
--     title VARCHAR(255),
--     public_description TEXT,
--     private_description TEXT,
--     price NUMERIC(10,2),
--     currency_code currency_code,
--     allowed_providers provider_code[],
--     allow_coupon_code BOOLEAN,
--     is_active BOOLEAN,
--     expires_at TIMESTAMPTZ,
--     success_url VARCHAR(2048),
--     metadata JSONB,
--     created_at TIMESTAMPTZ,
--     updated_at TIMESTAMPTZ
-- ) AS $$
-- BEGIN
--     RETURN QUERY
--     SELECT
--         pl.link_id,
--         pl.merchant_id,
--         pl.organization_id,
--         pl.link_type,
--         pl.url,
--         pl.product_id,
--         mp.name AS product_name,
--         mp.price AS product_price,
--         pl.plan_id,
--         sp.name AS plan_name,
--         sp.amount AS plan_amount,
--         pl.title,
--         pl.public_description,
--         pl.private_description,
--         pl.price,
--         pl.currency_code,
--         pl.allowed_providers,
--         pl.allow_coupon_code,
--         pl.is_active,
--         pl.expires_at,
--         pl.success_url,
--         pl.metadata,
--         pl.created_at,
--         pl.updated_at
--     FROM
--         payment_links pl
--         LEFT JOIN merchant_products mp ON pl.product_id = mp.product_id
--         LEFT JOIN subscription_plans sp ON pl.plan_id = sp.plan_id
--     WHERE
--         pl.merchant_id = p_merchant_id AND
--         (p_organization_id IS NULL OR pl.organization_id = p_organization_id) AND
--         (p_link_type IS NULL OR pl.link_type = p_link_type) AND
--         (p_currency_code IS NULL OR pl.currency_code = p_currency_code) AND
--         (p_is_active IS NULL OR pl.is_active = p_is_active) AND
--         (p_include_expired = true OR pl.expires_at IS NULL OR pl.expires_at > NOW())
--     ORDER BY
--         pl.created_at DESC
--     LIMIT p_page_size
--     OFFSET ((p_page - 1) * p_page_size);
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Here for reference
-- -- Function to create a new payment link
-- CREATE OR REPLACE FUNCTION public.create_payment_link(
--     p_merchant_id UUID,
--     p_organization_id UUID,
--     p_link_type link_type,
--     p_title VARCHAR(255),
--     p_currency_code currency_code,
--     p_public_description TEXT DEFAULT NULL,
--     p_private_description TEXT DEFAULT NULL,
--     p_price NUMERIC(10,2) DEFAULT NULL,
--     p_allowed_providers provider_code[] DEFAULT ARRAY[]::provider_code[],
--     p_allow_coupon_code BOOLEAN DEFAULT false,
--     p_expires_at TIMESTAMPTZ DEFAULT NULL,
--     p_success_url VARCHAR(2048) DEFAULT NULL,
--     p_cancel_url VARCHAR(2048) DEFAULT NULL,
--     p_plan_id UUID DEFAULT NULL,
--     p_product_id UUID DEFAULT NULL
-- )
-- RETURNS UUID AS $$
-- DECLARE
--     v_link_id UUID;
--     v_plan_amount NUMERIC(10,2);
--     v_product_price NUMERIC(10,2);
--     v_plan_currency_code currency_code;
--     v_product_currency_code currency_code;
--     v_website_url VARCHAR(2048);
-- BEGIN
--     -- Get the organization's website_url
--     SELECT website_url INTO v_website_url
--     FROM organizations
--     WHERE organization_id = p_organization_id;

--     -- Get the plan amount and currency code if a plan ID is provided
--     IF p_plan_id IS NOT NULL THEN
--         SELECT amount, currency_code INTO v_plan_amount, v_plan_currency_code
--         FROM subscription_plans
--         WHERE plan_id = p_plan_id;
--     END IF;

--     -- Get the product price and currency code if a product ID is provided
--     IF p_product_id IS NOT NULL THEN
--         SELECT price, currency_code INTO v_product_price, v_product_currency_code
--         FROM merchant_products
--         WHERE product_id = p_product_id;
--     END IF;

--     INSERT INTO payment_links (
--         merchant_id,
--         organization_id,
--         link_type,
--         currency_code,
--         title,
--         product_id,
--         plan_id,
--         public_description,
--         private_description,
--         price,
--         allowed_providers,
--         allow_coupon_code,
--         expires_at,
--         success_url,
--         cancel_url,
--         metadata
--     )
--     VALUES (
--         p_merchant_id,
--         p_organization_id,
--         p_link_type,
--         CASE
--             WHEN p_link_type = 'instant' THEN p_currency_code
--             WHEN p_link_type = 'plan' THEN v_plan_currency_code
--             WHEN p_link_type = 'product' THEN v_product_currency_code
--             ELSE p_currency_code
--         END,
--         p_title,
--         p_product_id,
--         p_plan_id,
--         p_public_description,
--         p_private_description,
--         CASE
--             WHEN p_link_type = 'instant' THEN p_price
--             ELSE NULL
--         END,
--         p_allowed_providers,
--         p_allow_coupon_code,
--         p_expires_at,
--         p_success_url,
--         COALESCE(p_cancel_url, v_website_url, 'https://lomi.africa'),
--         NULL
--     )
--     RETURNING link_id INTO v_link_id;

--     RETURN v_link_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Here for reference
-- -- Function to update a payment link
-- CREATE OR REPLACE FUNCTION public.update_payment_link(
--     p_link_id UUID,
--     p_title VARCHAR(255) DEFAULT NULL,
--     p_public_description TEXT DEFAULT NULL,
--     p_private_description TEXT DEFAULT NULL,
--     p_price NUMERIC(10,2) DEFAULT NULL,
--     p_is_active BOOLEAN DEFAULT NULL,
--     p_expires_at TIMESTAMPTZ DEFAULT NULL,
--     p_success_url VARCHAR(2048) DEFAULT NULL,
--     p_cancel_url VARCHAR(2048) DEFAULT NULL,
--     p_allowed_providers provider_code[] DEFAULT NULL
-- )
-- RETURNS payment_links AS $$
-- DECLARE
--     v_link_type link_type;
--     v_updated_link payment_links;
-- BEGIN
--     -- Get the link type of the payment link
--     SELECT link_type INTO v_link_type
--     FROM payment_links
--     WHERE link_id = p_link_id;

--     -- Update the payment link based on the link type
--     IF v_link_type = 'product' OR v_link_type = 'plan' THEN
--         UPDATE payment_links
--         SET
--             title = COALESCE(p_title, title),
--             public_description = COALESCE(p_public_description, public_description),
--             private_description = COALESCE(p_private_description, private_description),
--             is_active = COALESCE(p_is_active, is_active),
--             expires_at = COALESCE(p_expires_at, expires_at),
--             success_url = COALESCE(p_success_url, success_url),
--             cancel_url = COALESCE(p_cancel_url, cancel_url),
--             allowed_providers = COALESCE(p_allowed_providers, allowed_providers),
--             updated_at = NOW()
--         WHERE link_id = p_link_id
--         RETURNING * INTO v_updated_link;
--     ELSIF v_link_type = 'instant' THEN
--         UPDATE payment_links
--         SET
--             title = COALESCE(p_title, title),
--             public_description = COALESCE(p_public_description, public_description),
--             private_description = COALESCE(p_private_description, private_description),
--             price = COALESCE(p_price, price),
--             is_active = COALESCE(p_is_active, is_active),
--             expires_at = COALESCE(p_expires_at, expires_at),
--             success_url = COALESCE(p_success_url, success_url),
--             cancel_url = COALESCE(p_cancel_url, cancel_url),
--             allowed_providers = COALESCE(p_allowed_providers, allowed_providers),
--             updated_at = NOW()
--         WHERE link_id = p_link_id
--         RETURNING * INTO v_updated_link;
--     END IF;

--     RETURN v_updated_link;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Here for reference
-- Function to safely delete a payment link by first handling related records
-- CREATE OR REPLACE FUNCTION public.safe_delete_payment_link(
--     p_link_id UUID
-- )
-- RETURNS BOOLEAN AS $$
-- DECLARE
--     v_success BOOLEAN := FALSE;
-- BEGIN
--     -- First, update any associated checkout sessions to set payment_link_id to NULL
--     UPDATE checkout_sessions
--     SET payment_link_id = NULL
--     WHERE payment_link_id = p_link_id;

--     -- Then delete the payment link
--     DELETE FROM payment_links
--     WHERE link_id = p_link_id;

--     v_success := TRUE;
--     RETURN v_success;
-- EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE 'Error deleting payment link: %', SQLERRM;
--     RETURN FALSE;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- --
-- -- Get Merchant Organization ID Function
-- --
-- CREATE OR REPLACE FUNCTION public.get_merchant_organization_id(
--     p_merchant_id UUID
-- )
-- RETURNS UUID AS $$
-- DECLARE
--     v_organization_id UUID;
-- BEGIN
--     SELECT organization_id INTO v_organization_id
--     FROM merchants
--     WHERE merchant_id = p_merchant_id;

--     IF v_organization_id IS NULL THEN
--         RAISE EXCEPTION 'No organization found for merchant_id %', p_merchant_id;
--     END IF;

--     RETURN v_organization_id;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

--
-- Grant necessary permissions to service_role for API functions
--

-- Grant execute on functions defined in this file
GRANT EXECUTE ON FUNCTION public.get_merchant_organization_id(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_payment_link(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_checkout_sessions(UUID, checkout_session_status, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_merchant_providers(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_customer(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_customers(UUID, VARCHAR, VARCHAR, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_providers(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_product(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_products(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_transactions(UUID, transaction_status[], provider_code, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_refund(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_refund_status(UUID, UUID, refund_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_subscription_plan(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_subscription_plans(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_api_key(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(UUID, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_api_error(VARCHAR, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.ping_api() TO service_role;

-- Grant execute on functions defined in other files but used by API controllers
-- Note: Ensure these function definitions match parameters expected by the grants.

-- Payment Link Functions (from 20240828000027_functions_payment_links.sql)
GRANT EXECUTE ON FUNCTION public.create_payment_link(UUID, UUID, link_type, VARCHAR(255), currency_code, TEXT, TEXT, NUMERIC(10,2), provider_code[], BOOLEAN, BOOLEAN, TIMESTAMPTZ, VARCHAR(2048), VARCHAR(2048), UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fetch_payment_links(UUID, UUID, link_type, currency_code, BOOLEAN, INTEGER, INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_payment_link(UUID, VARCHAR(255), TEXT, TEXT, NUMERIC(10,2), BOOLEAN, TIMESTAMPTZ, VARCHAR(2048), VARCHAR(2048), provider_code[], BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.safe_delete_payment_link(UUID) TO service_role;

-- Customer Functions (from 20240828000022_functions_customers.sql)
GRANT EXECUTE ON FUNCTION public.create_customer(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_customer(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_customer(UUID) TO service_role;

-- Product Functions (from 20240828000025_functions_products.sql)
GRANT EXECUTE ON FUNCTION public.create_product(UUID, UUID, VARCHAR(255), TEXT, NUMERIC(10,2), currency_code, TEXT, BOOLEAN, BOOLEAN, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_product(UUID, VARCHAR(255), TEXT, NUMERIC(10,2), TEXT, BOOLEAN, BOOLEAN, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_product(UUID) TO service_role;

-- Subscription Plan Functions (from 20240828000024_functions_subscriptions.sql)
GRANT EXECUTE ON FUNCTION public.create_subscription_plan(UUID, UUID, VARCHAR, TEXT, frequency, NUMERIC, currency_code, failed_payment_action, INT, JSONB, first_payment_type, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_subscription_plan(UUID, VARCHAR, TEXT, frequency, NUMERIC, failed_payment_action, INT, JSONB, BOOLEAN, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_subscription_plan(UUID) TO service_role;

-- Transaction/Checkout Functions (from 20240828000046_functions_checkout_transaction.sql)
GRANT EXECUTE ON FUNCTION public.create_transaction(UUID, UUID, UUID, NUMERIC, currency_code, provider_code, payment_method_code, TEXT, UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_refund(UUID, UUID, NUMERIC, TEXT, VARCHAR, VARCHAR, provider_code, JSONB) TO service_role;

-- Webhook Functions (from 20240828000047_functions_webhooks.sql)
GRANT EXECUTE ON FUNCTION public.delete_webhook(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.test_webhook(UUID) TO service_role;

-- Add grants for any other functions called by API controllers if needed