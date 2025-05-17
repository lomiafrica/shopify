import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import shopify from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(shopify.login) };
};

export default function IndexPage() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-teal-50 to-emerald-100 flex flex-col justify-center items-center p-6 selection:bg-green-800 selection:text-white">
      <div className="bg-white shadow-2xl rounded-xl p-8 md:p-12 w-full max-w-2xl text-center">
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-green-800 mb-4">
            Lomi
          </h1>
          <p className="text-2xl md:text-3xl font-semibold text-green-700 mb-3">
            Empowering West African Businesses
          </p>
          <p className="text-gray-600 text-lg">
            Integrate Lomi with your Shopify store and unlock growth with reliable, open-source payment processing designed for you.
          </p>
        </header>

        {showForm && (
          <section className="mb-10">
            <Form
              method="post"
              action="/auth/login"
              className="space-y-6"
            >
              <div>
                <label
                  htmlFor="shop"
                  className="block text-sm font-medium text-gray-700 text-left mb-1"
                >
                  Shopify Domain
                </label>
                <input
                  type="text"
                  name="shop"
                  id="shop"
                  className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  placeholder="your-store-name.myshopify.com"
                  required
                />
                <p className="mt-2 text-xs text-gray-500 text-left">
                  e.g: my-shop-domain.myshopify.com
                </p>
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150"
              >
                Log In & Connect Lomi
              </button>
            </Form>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold text-gray-700 mb-6">
            Why Choose Lomi for Your Shopify Store?
          </h2>
          <ul className="space-y-4 text-left">
            {[
              {
                title: "Built for West Africa",
                description: "Understands your market, supports your customers.",
              },
              {
                title: "Simple Shopify Integration",
                description: "Get started quickly with our dedicated app.",
              },
              {
                title: "Transparent & Open",
                description: "Trustworthy payment solutions to help your business scale.",
              },
            ].map((feature) => (
              <li key={feature.title} className="flex items-start p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors duration-150">
                <svg className="flex-shrink-0 h-6 w-6 text-green-600 mr-3 mt-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <strong className="font-semibold text-green-800">{feature.title}</strong>.
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <footer className="mt-12 text-center">
        <p className="text-sm text-gray-600">
          Lomi Payments &copy; {new Date().getFullYear()} - Powering Growth for West African E-commerce.
        </p>
      </footer>
    </div>
  );
}
