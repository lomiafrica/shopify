// Polyfill for Web Crypto API for Node.js
// Ensures globalThis.crypto is available before Shopify libraries are loaded.

// Check if crypto is already available
if (!globalThis.crypto) {
  try {
    // Try to use Node.js built-in crypto
    const nodeRequire = typeof require !== "undefined" ? require : undefined;

    if (nodeRequire) {
      // Use require for better compatibility
      let webcrypto;
      try {
        webcrypto = nodeRequire("node:crypto").webcrypto;
      } catch {
        webcrypto = nodeRequire("crypto").webcrypto;
      }

      if (
        webcrypto &&
        typeof webcrypto.getRandomValues === "function" &&
        webcrypto.subtle
      ) {
        globalThis.crypto = webcrypto;
      }
    }
  } catch {
    // Polyfill failed, but that's okay - the app may still work
  }
}

export {};
