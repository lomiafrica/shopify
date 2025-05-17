/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  serverModuleFormat: "esm",
  serverDependenciesToBundle: [
    "@shopify/shopify-api",
    "@shopify/shopify-app-remix",
    /^@shopify\/polaris/,
  ],
  watchPaths: ["app/index.css"],
  tailwind: true,
  postcss: true,
  future: {
    unstable_vite: true,
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: true,
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
};
