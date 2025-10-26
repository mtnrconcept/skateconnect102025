let analyticsInitialized = false;

export function initAnalytics(): void {
  if (analyticsInitialized) {
    return;
  }

  analyticsInitialized = true;

  if (import.meta.env?.DEV) {
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  // Placeholder for production analytics initialisation.
  // Third-party SDKs (TikTok, Meta, etc.) should be loaded here when needed.
}
