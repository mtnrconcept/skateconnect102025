let stripePromise: Promise<StripeClient | null> | null = null;

const FALLBACK_STRIPE_PUBLISHABLE_KEY =
  'pk_test_51SHGJ2GTQigE34suvg0kiCn1Kmb6cTh53oT2M88aB6OO76eaqMxv6GJgxFYXuEQ2WecbRViy6L8WU1HjeGToCCwX00xdRrQVWr';

interface StripeClient {
  redirectToCheckout(options: { sessionId: string }): Promise<{ error?: { message?: string } } | void>;
}

interface StripeConstructor {
  (publishableKey: string): StripeClient;
}

declare global {
  interface Window {
    Stripe?: StripeConstructor;
  }
}

function loadStripeScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.Stripe) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Unable to load Stripe.js script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Stripe.js script'));
    document.head.appendChild(script);
  });
}

export const isStripeEnabled = () => {
  const key = typeof import.meta !== 'undefined' ? (import.meta as ImportMeta).env?.VITE_STRIPE_PUBLISHABLE_KEY : undefined;
  if (key && typeof key === 'string' && key.trim().length > 0) {
    return true;
  }

  if (typeof process !== 'undefined') {
    const envKey = process.env?.VITE_STRIPE_PUBLISHABLE_KEY ?? process.env?.STRIPE_PUBLISHABLE_KEY;
    return typeof envKey === 'string' && envKey.trim().length > 0;
  }

  return FALLBACK_STRIPE_PUBLISHABLE_KEY.trim().length > 0;
};

function getPublishableKey(): string | null {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as ImportMeta).env : undefined;
  const viteKey = metaEnv?.VITE_STRIPE_PUBLISHABLE_KEY;
  if (viteKey && typeof viteKey === 'string' && viteKey.trim().length > 0) {
    return viteKey;
  }

  if (typeof process !== 'undefined') {
    const nodeKey = process.env?.VITE_STRIPE_PUBLISHABLE_KEY ?? process.env?.STRIPE_PUBLISHABLE_KEY;
    if (nodeKey && nodeKey.trim().length > 0) {
      return nodeKey;
    }
  }

  if (FALLBACK_STRIPE_PUBLISHABLE_KEY.trim().length > 0) {
    console.info('Using fallback Stripe publishable key for demo checkout experience.');
    return FALLBACK_STRIPE_PUBLISHABLE_KEY;
  }

  return null;
}

export async function getStripeClient(): Promise<StripeClient | null> {
  if (stripePromise) {
    return stripePromise;
  }

  stripePromise = (async () => {
    const publishableKey = getPublishableKey();
    if (!publishableKey || typeof window === 'undefined') {
      return null;
    }

    try {
      await loadStripeScript();
    } catch (cause) {
      console.error('Unable to load Stripe.js', cause);
      return null;
    }

    if (!window.Stripe) {
      console.error('Stripe.js failed to initialise');
      return null;
    }

    try {
      return window.Stripe(publishableKey);
    } catch (cause) {
      console.error('Unable to instantiate Stripe client', cause);
      return null;
    }
  })();

  return stripePromise;
}
