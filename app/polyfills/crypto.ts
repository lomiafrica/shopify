// Polyfill for Web Crypto API for Node.js
// Ensures globalThis.crypto is available before Shopify libraries are loaded.

type MaybeRequire = ((id: string) => { webcrypto?: Crypto }) | undefined;

function readGlobalRequire(): MaybeRequire {
  // SAFETY: Node may expose require on globalThis in CJS polyfill contexts.
  const candidate = (globalThis as { require?: MaybeRequire }).require;
  if (candidate === undefined) return undefined;
  // SAFETY: Node's require is a callable CJS loader when present on globalThis.
  return candidate as NonNullable<MaybeRequire>;
}

function asWebCrypto(value: Crypto | undefined): Crypto | undefined {
  if (value === undefined) return undefined;
  if (!("getRandomValues" in value) || !("subtle" in value)) return undefined;
  return value;
}

if (!globalThis.crypto) {
  try {
    const nodeRequire = readGlobalRequire();
    if (nodeRequire) {
      let webcrypto: Crypto | undefined;
      try {
        webcrypto = asWebCrypto(nodeRequire("node:crypto").webcrypto);
      } catch {
        webcrypto = asWebCrypto(nodeRequire("crypto").webcrypto);
      }

      if (webcrypto) {
        globalThis.crypto = webcrypto;
      }
    }
  } catch {
    // Polyfill failed, but that's okay - the app may still work
  }
}

export {};
