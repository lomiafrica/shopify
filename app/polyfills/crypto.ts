// Polyfill for Web Crypto API for Node.js
// Ensures globalThis.crypto is available before Shopify libraries are loaded.
import { webcrypto as NodeJsWebCrypto } from 'node:crypto';

console.log('[CryptoPolyfill] Starting polyfill execution.');

if (NodeJsWebCrypto) {
  console.log('[CryptoPolyfill] Node.js `webcrypto` object imported successfully.');
  console.log(`[CryptoPolyfill] typeof NodeJsWebCrypto.getRandomValues: ${typeof NodeJsWebCrypto.getRandomValues}`);
  console.log(`[CryptoPolyfill] NodeJsWebCrypto.getRandomValues === null: ${NodeJsWebCrypto.getRandomValues === null}`);
  console.log(`[CryptoPolyfill] typeof NodeJsWebCrypto.subtle: ${typeof NodeJsWebCrypto.subtle}`);
  console.log(`[CryptoPolyfill] NodeJsWebCrypto.subtle === null: ${NodeJsWebCrypto.subtle === null}`);

  if (typeof NodeJsWebCrypto.getRandomValues === 'function' && NodeJsWebCrypto.subtle && typeof NodeJsWebCrypto.subtle === 'object') {
    // If Node's webcrypto object seems complete, assign it.
    // This will overwrite any existing globalThis.crypto.
    // @ts-ignore
    globalThis.crypto = NodeJsWebCrypto as any;
    console.log('[CryptoPolyfill] Assigned Node.js `webcrypto` to `globalThis.crypto`.');
  } else {
    console.error('[CryptoPolyfill] Node.js `webcrypto` object is missing required properties (getRandomValues or subtle). Cannot use it as polyfill.');
    if (globalThis.crypto) {
      console.error(`[CryptoPolyfill] Existing globalThis.crypto.getRandomValues type: ${typeof globalThis.crypto.getRandomValues}`);
      console.error(`[CryptoPolyfill] Existing globalThis.crypto.subtle type: ${typeof globalThis.crypto.subtle}`);
    } else {
      console.error('[CryptoPolyfill] globalThis.crypto was also undefined when NodeJsWebCrypto was found incomplete.');
    }
  }
} else {
  console.error('[CryptoPolyfill] Failed to import `webcrypto` from `node:crypto`. This is a critical issue for the polyfill.');
  if (globalThis.crypto) {
    console.error('[CryptoPolyfill] `node:crypto.webcrypto` import failed, but globalThis.crypto exists.');
    console.error(`[CryptoPolyfill] Existing globalThis.crypto.getRandomValues type: ${typeof globalThis.crypto.getRandomValues}`);
    console.error(`[CryptoPolyfill] Existing globalThis.crypto.subtle type: ${typeof globalThis.crypto.subtle}`);
  } else {
    console.error('[CryptoPolyfill] `node:crypto.webcrypto` import failed, and globalThis.crypto was also undefined.');
  }
}

// Final verification log
if (globalThis.crypto) {
  console.log(`[CryptoPolyfill] Final check: globalThis.crypto is defined.`);
  console.log(`[CryptoPolyfill] Final check: typeof globalThis.crypto.getRandomValues: ${typeof globalThis.crypto.getRandomValues}`);
  console.log(`[CryptoPolyfill] Final check: globalThis.crypto.getRandomValues === null: ${globalThis.crypto.getRandomValues === null}`);
  console.log(`[CryptoPolyfill] Final check: typeof globalThis.crypto.subtle: ${typeof globalThis.crypto.subtle}`);
  console.log(`[CryptoPolyfill] Final check: globalThis.crypto.subtle === null: ${globalThis.crypto.subtle === null}`);
  if (typeof globalThis.crypto.getRandomValues !== 'function') {
    console.error('[CryptoPolyfill] CRITICAL FAILURE: globalThis.crypto.getRandomValues is NOT a function after polyfill attempt.');
  } else {
    console.log('[CryptoPolyfill] SUCCESS: globalThis.crypto.getRandomValues IS a function.');
  }
  if (!(globalThis.crypto.subtle && typeof globalThis.crypto.subtle === 'object')) {
    console.error('[CryptoPolyfill] CRITICAL FAILURE: globalThis.crypto.subtle is NOT an object after polyfill attempt.');
  } else {
    console.log('[CryptoPolyfill] SUCCESS: globalThis.crypto.subtle IS an object.');
  }
} else {
  console.error('[CryptoPolyfill] CRITICAL FAILURE: globalThis.crypto is UNDEFINED after polyfill attempt.');
}
