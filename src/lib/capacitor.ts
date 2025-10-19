export const isNative = () => {
  return false;
};

export const getPlatform = () => {
  return 'web';
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

export const requestNotificationPermissions = async () => {
  console.warn('Push notifications are only available on native platforms. Install @capacitor/push-notifications to use this feature.');
  return false;
};

export const addPushNotificationListeners = (
  onReceived: (notification: any) => void,
  onActionPerformed: (action: any) => void
) => {
  console.warn('Push notifications are only available on native platforms.');
};

export const removePushNotificationListeners = async () => {
  console.warn('Push notifications are only available on native platforms.');
};
