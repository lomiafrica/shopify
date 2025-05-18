/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  serverDependenciesToBundle: [
    "@shopify/shopify-api",
    "@shopify/shopify-app-remix",
    /^@shopify\/polaris/,
  ],
  tailwind: true,
  postcss: false,
};
