import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export const isNative = () => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = () => {
  return Capacitor.getPlatform();
};

export const capturePhoto = async () => {
  throw new Error('Camera is only available on native platforms. Install @capacitor/camera to use this feature.');
};

export const pickPhoto = async () => {
  throw new Error('Photo picker is only available on native platforms. Install @capacitor/camera to use this feature.');
};

export const getCurrentPosition = async () => {
  if ('geolocation' in navigator) {
    return new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      );
    });
  }
  throw new Error('Geolocation is not available');
};

let nativeListenerHandles: PluginListenerHandle[] = [];
let webMessageHandler: ((event: MessageEvent) => void) | null = null;

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (isNative()) {
    const permissions = await PushNotifications.checkPermissions();

    if (permissions.receive !== 'granted') {
      const requestResult = await PushNotifications.requestPermissions();
      if (requestResult.receive !== 'granted') {
        return false;
      }
    }

    await PushNotifications.register();
    return true;
  }

  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    console.warn('Notifications API is not available in this environment.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          console.warn('No service worker registered to handle web push notifications.');
        }
      } catch (error) {
        console.warn('Unable to verify service worker registration for web push notifications:', error);
      }
    }
    return true;
  }

  return false;
};

export const addPushNotificationListeners = (
  onReceived: (notification: any) => void,
  onActionPerformed: (action: any) => void
) => {
  if (isNative()) {
    void removePushNotificationListeners();

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      onReceived(notification);
    }).then((handle) => {
      nativeListenerHandles.push(handle);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      onActionPerformed(action);
    }).then((handle) => {
      nativeListenerHandles.push(handle);
    });

    return;
  }

  if (typeof window === 'undefined') {
    console.warn('Cannot register web push listeners on the server.');
    return;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are required for web push notifications.');
    return;
  }

  if (webMessageHandler) {
    navigator.serviceWorker.removeEventListener('message', webMessageHandler as EventListener);
  }

  webMessageHandler = (event: MessageEvent) => {
    const payload = event.data;

    if (!payload) {
      return;
    }

    if (payload?.type === 'push-notification-action') {
      onActionPerformed(payload.detail ?? payload);
      return;
    }

    onReceived(payload.detail ?? payload);
  };

  navigator.serviceWorker.addEventListener('message', webMessageHandler as EventListener);
};

export const removePushNotificationListeners = async () => {
  await Promise.all(
    nativeListenerHandles.map(async (handle) => {
      try {
        await handle.remove();
      } catch (error) {
        console.warn('Failed to remove native push notification listener:', error);
      }
    })
  );

  nativeListenerHandles = [];

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && webMessageHandler) {
    navigator.serviceWorker.removeEventListener('message', webMessageHandler as EventListener);
  }

  webMessageHandler = null;
};
