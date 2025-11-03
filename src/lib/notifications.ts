import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase.js';
import { requestNotificationPermissions, addPushNotificationListeners } from './capacitor';

export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'message' | 'spot_comment' | 'challenge_vote' | 'gos_invite';
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  created_at: string;
  updated_at: string;
}

export const setupPushNotifications = async (): Promise<boolean> => {
  try {
    const granted = await requestNotificationPermissions();

    if (granted) {
      addPushNotificationListeners(
        (notification) => {
          console.log('Push notification received:', notification);
        },
        (action) => {
          console.log('Push notification action performed:', action);
        }
      );
    }

    return granted;
  } catch (error) {
    console.error('Error setting up push notifications:', error);
    return false;
  }
};

export const registerPushToken = async (
  token: string,
  platform: 'ios' | 'android' | 'web'
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('push_tokens')
    .upsert({
      user_id: user.id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'token',
    });

  if (error) {
    throw error;
  }
};

export const unregisterPushToken = async (token: string): Promise<void> => {
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('token', token);

  if (error) {
    throw error;
  }
};

export const getNotifications = async (
  limit: number = 20,
  offset: number = 0
): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return data || [];
};

export const getUnreadCount = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('get_unread_count');

  if (error) {
    throw error;
  }

  return data || 0;
};

export const markAsRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });

  if (error) {
    throw error;
  }
};

export const markAllAsRead = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('mark_all_notifications_read');

  if (error) {
    throw error;
  }

  return data || 0;
};

interface SubscribeOptions {
  userId?: string;
  retryDelayMs?: number;
}

const DEFAULT_RETRY_DELAY = 3000;

export const subscribeToNotifications = (
  onNotification: (notification: Notification) => void,
  options: SubscribeOptions = {}
) => {
  let channel: RealtimeChannel | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let isActive = true;
  let failureCount = 0;
  const MAX_FAILURES = 5;

  const retryDelay = options.retryDelayMs ?? DEFAULT_RETRY_DELAY;

  const clearChannel = () => {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };

  const scheduleRetry = () => {
    if (!isActive) {
      return;
    }

    if (failureCount >= MAX_FAILURES) {
      if (failureCount === MAX_FAILURES) {
        console.warn('Notifications realtime disabled after repeated failures.');
      }
      failureCount += 1;
      clearChannel();
      return;
    }

    if (retryTimer) {
      clearTimeout(retryTimer);
    }

    retryTimer = setTimeout(() => {
      retryTimer = null;
      void setupSubscription();
    }, retryDelay);
  };

  const setupSubscription = async () => {
    try {
      clearChannel();

      const userId = options.userId ?? (await getCurrentUserId());

      if (!userId) {
        console.warn('subscribeToNotifications: no authenticated user found. Retrying...');
        scheduleRetry();
        return;
      }

      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            onNotification(payload.new as Notification);
          }
        )
        .subscribe((status) => {
          if (!isActive) {
            return;
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            failureCount += 1;
            if (failureCount <= MAX_FAILURES) {
              console.warn('Notifications channel disconnected, attempting to reconnect...', status);
            }
            scheduleRetry();
          } else if (status === 'SUBSCRIBED') {
            failureCount = 0;
          }
        });
    } catch (error) {
      console.error('Failed to subscribe to notifications:', error);
      failureCount += 1;
      scheduleRetry();
    }
  };

  const getCurrentUserId = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user?.id ?? null;
  };

  void setupSubscription();

  return () => {
    isActive = false;

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    clearChannel();
  };
};

export type NotificationPreferences = Record<string, boolean>;

export const getNotificationPreferences = async (
  defaults: NotificationPreferences = {}
): Promise<NotificationPreferences> => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    return defaults;
  }

  const { data, error } = await supabase
    .from('notification_settings')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.preferences || typeof data.preferences !== 'object') {
    return defaults;
  }

  return {
    ...defaults,
    ...(data.preferences as NotificationPreferences),
  };
};

export const saveNotificationPreferences = async (
  preferences: NotificationPreferences
): Promise<void> => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('notification_settings')
    .upsert({
      user_id: user.id,
      preferences,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
};

export const createNotification = async (
  userId: string,
  type: Notification['type'],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<string> => {
  const { data: result, error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_body: body,
    p_data: data,
  });

  if (error) {
    throw error;
  }

  return result;
};

export const getNotificationIcon = (type: Notification['type']): string => {
  const icons: Record<Notification['type'], string> = {
    like: '❤️',
    comment: '💬',
    follow: '👤',
    mention: '@',
    message: '✉️',
    spot_comment: '📍',
    challenge_vote: '🏆',
  };

  return icons[type] || '🔔';
};

export const getNotificationColor = (type: Notification['type']): string => {
  const colors: Record<Notification['type'], string> = {
    like: 'text-red-500',
    comment: 'text-blue-500',
    follow: 'text-green-500',
    mention: 'text-purple-500',
    message: 'text-cyan-500',
    spot_comment: 'text-orange-500',
    challenge_vote: 'text-yellow-500',
  };

  return colors[type] || 'text-gray-500';
};
