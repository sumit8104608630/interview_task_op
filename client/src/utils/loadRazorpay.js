/**
 * Dynamically loads the official Razorpay Checkout SDK script (https://checkout.razorpay.com/v1/checkout.js).
 * Returns a promise resolving to true if loaded or already present on window.Razorpay.
 *
 * @returns {Promise<boolean>}
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('[Razorpay Checkout] Failed to load checkout script.');
      resolve(false);
    };

    document.body.appendChild(script);
  });
};

export default loadRazorpayScript;
