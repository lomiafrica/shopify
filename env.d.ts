/// <reference types="vite/client" />
/// <reference types="@remix-run/node" />

declare module '*.css?url' {
  const url: string;
  export default url;
}

declare module '*.scss?url' {
  const url: string;
  export default url;
}

// Add any other custom type declarations needed for your project below