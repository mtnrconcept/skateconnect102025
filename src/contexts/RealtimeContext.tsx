import { createContext, useContext, useMemo, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { subscribeToNotifications, type Notification } from '../lib/notifications';
import { supabase } from '../lib/supabase.js';
import type { Badge } from '../types';

interface RealtimeContextValue {
  registerNotificationListener: (listener: (notification: Notification) => void) => () => void;
  registerBadgeAwardListener: (listener: (badge: Badge) => void) => () => void;
}

const noop = () => {};

const RealtimeContext = createContext<RealtimeContextValue>({
  registerNotificationListener: () => noop,
  registerBadgeAwardListener: () => noop,
});

export const useRealtime = () => useContext(RealtimeContext);

interface RealtimeProviderProps {
  userId?: string | null;
  children: ReactNode;
}

const CHANNEL_RETRY_DELAY = 3000;

export function RealtimeProvider({ userId, children }: RealtimeProviderProps) {
  const notificationListeners = useRef(new Set<(notification: Notification) => void>());
  const badgeListeners = useRef(new Set<(badge: Badge) => void>());

  const notifyNotificationListeners = useCallback((notification: Notification) => {
    notificationListeners.current.forEach((listener) => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }, []);

  const notifyBadgeListeners = useCallback((badge: Badge) => {
    badgeListeners.current.forEach((listener) => {
      try {
        listener(badge);
      } catch (error) {
        console.error('Error in badge award listener:', error);
      }
    });
  }, []);

  useEffect(() => {
    if (!userId) {
      return noop;
    }

    const unsubscribe = subscribeToNotifications((notification) => {
      notifyNotificationListeners(notification);
    }, { userId });

    return () => {
      unsubscribe();
    };
  }, [userId, notifyNotificationListeners]);

  useEffect(() => {
    if (!userId) {
      return noop;
    }

    let isCancelled = false;
    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearChannel = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const scheduleRetry = () => {
      if (isCancelled) {
        return;
      }

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      retryTimer = setTimeout(() => {
        retryTimer = null;
        void setupChannel();
      }, CHANNEL_RETRY_DELAY);
    };

    const setupChannel = async () => {
      try {
        clearChannel();

        channel = supabase
          .channel(`badge-awards-${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'user_badges',
              filter: `user_id=eq.${userId}`,
            },
            async (payload) => {
              try {
                const { data, error } = await supabase
                  .from('badges')
                  .select('*')
                  .eq('id', payload.new.badge_id)
                  .single();

                if (error) {
                  throw error;
                }

                if (data) {
                  notifyBadgeListeners(data as Badge);
                }
              } catch (error) {
                console.error('Failed to fetch badge data for award:', error);
              }
            }
          )
          .subscribe((status) => {
            if (isCancelled) {
              return;
            }

            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              console.warn('Badge awards channel disconnected, attempting to reconnect...', status);
              scheduleRetry();
            }
          });
      } catch (error) {
        console.error('Failed to subscribe to badge awards channel:', error);
        scheduleRetry();
      }
    };

    void setupChannel();

    return () => {
      isCancelled = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }

      clearChannel();
    };
  }, [userId, notifyBadgeListeners]);

  const registerNotificationListener = useCallback(
    (listener: (notification: Notification) => void) => {
      notificationListeners.current.add(listener);
      return () => {
        notificationListeners.current.delete(listener);
      };
    },
    []
  );

  const registerBadgeAwardListener = useCallback(
    (listener: (badge: Badge) => void) => {
      badgeListeners.current.add(listener);
      return () => {
        badgeListeners.current.delete(listener);
      };
    },
    []
  );

  const value = useMemo<RealtimeContextValue>(() => ({
    registerNotificationListener,
    registerBadgeAwardListener,
  }), [registerNotificationListener, registerBadgeAwardListener]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
