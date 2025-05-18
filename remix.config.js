/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  serverModuleFormat: "cjs",
  serverDependenciesToBundle: [
    "@shopify/shopify-api",
    "@shopify/shopify-app-remix",
    /^@shopify\/polaris/,
  ],
  tailwind: true,
  postcss: false,
  future: {
    unstable_vite: true,
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: true,
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
};
