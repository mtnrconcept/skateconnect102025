export interface TrackingEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

const isDevEnvironment = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

export function trackEvent(event: TrackingEvent): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('skateconnect:analytics', { detail: event }));
    } catch (error) {
      if (isDevEnvironment) {
        console.warn('[analytics] unable to dispatch event', error);
      }
    }
  }

  if (isDevEnvironment) {
    console.debug('[analytics:event]', event);
  }
}
