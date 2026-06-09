(function () {
  const PROXY_PATH = "/apps/lomi/cart-pay";

  function setLoading(button, loading) {
    const label = button.querySelector("[data-lomi-pay-label]");
    const loadingEl = button.querySelector("[data-lomi-pay-loading]");
    button.disabled = loading;
    if (label) label.hidden = loading;
    if (loadingEl) loadingEl.hidden = !loading;
  }

  function showError(root, message) {
    const errorEl = root.querySelector("[data-lomi-pay-error]");
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  async function startPayment(root) {
    const button = root.querySelector("[data-lomi-pay-button]");
    if (!button) return;

    showError(root, "");
    setLoading(button, true);

    try {
      const cartResponse = await fetch("/cart.js", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!cartResponse.ok) {
        throw new Error("Could not read cart");
      }

      const cart = await cartResponse.json();

      if (!cart.item_count || !cart.items?.length) {
        throw new Error("Your cart is empty");
      }

      const payResponse = await fetch(PROXY_PATH, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ items: cart.items }),
      });

      const data = await payResponse.json().catch(function () {
        return {};
      });

      if (!payResponse.ok) {
        throw new Error(data.error || "Failed to start payment");
      }

      const checkoutUrl = data.checkout_url || data.url;
      if (!checkoutUrl) {
        throw new Error("No checkout URL returned");
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Payment could not be started";
      showError(root, message);
      setLoading(button, false);
    }
  }

  function init() {
    document.querySelectorAll("[data-lomi-cart-pay]").forEach(function (root) {
      const button = root.querySelector("[data-lomi-pay-button]");
      if (!button || button.dataset.lomiBound === "true") return;
      button.dataset.lomiBound = "true";
      button.addEventListener("click", function () {
        startPayment(root);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("shopify:section:load", init);
})();
