import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import shopify from "~/shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(shopify.login) };
};

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const [shop, setShop] = useState("");

  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      <div className={styles.index}>
        <div className={styles.content}>
          <h1 className={styles.heading}>
            <img src="/lomi_d.webp" alt="lomi." className={styles.logoImage} />
          </h1>
          <p className={styles.text}>
            Helping West African entrepreneurs sell online
          </p>
          {showForm && (
            <Card>
              <Form method="post" action="/auth/login">
                <FormLayout>
                  <Text variant="headingMd" as="h2">
                    Log in
                  </Text>
                  <TextField
                    type="text"
                    name="shop"
                    label="Shop domain"
                    helpText="e.g: my-shop-domain.myshopify.com"
                    value={shop}
                    onChange={setShop}
                    autoComplete="on"
                  />
                  <Button submit>Log in</Button>
                </FormLayout>
              </Form>
            </Card>
          )}
          <ul className={styles.list}>
            <li>
              <strong>Seamless integration</strong>Effortlessly connect lomi. to
              your Shopify store in minutes. Start accepting payments quickly
              with our user-friendly setup, no complex coding required.
            </li>
            <li>
              <strong>Reach more customers</strong>Enable your customers to pay
              using popular local payment methods. Expand your market across
              West Africa by offering familiar and trusted payment options.
            </li>
            <li>
              <strong>Secure and reliable</strong>Process transactions with
              confidence. lomi. ensures top-tier security for every one of your
              payment and provides reliable, instant payouts to your bank
              account.
            </li>
          </ul>
        </div>
      </div>
    </PolarisAppProvider>
  );
}
