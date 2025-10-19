import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';

export const isNative = () => Capacitor.isNativePlatform();

export const getPlatform = () => Capacitor.getPlatform();

export const capturePhoto = async () => {
  if (!isNative()) {
    throw new Error('Camera is only available on native platforms');
  }

  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
    });

    return {
      base64: image.base64String,
      format: image.format,
    };
  } catch (error) {
    console.error('Error capturing photo:', error);
    throw error;
  }
};

export const pickPhoto = async () => {
  if (!isNative()) {
    throw new Error('Photo picker is only available on native platforms');
  }

  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
    });

    return {
      base64: image.base64String,
      format: image.format,
    };
  } catch (error) {
    console.error('Error picking photo:', error);
    throw error;
  }
};

export const getCurrentPosition = async () => {
  try {
    const coordinates = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      latitude: coordinates.coords.latitude,
      longitude: coordinates.coords.longitude,
      accuracy: coordinates.coords.accuracy,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
};

export const requestNotificationPermissions = async () => {
  if (!isNative()) {
    console.warn('Push notifications are only available on native platforms');
    return false;
  }

  try {
    const permission = await PushNotifications.requestPermissions();

    if (permission.receive === 'granted') {
      await PushNotifications.register();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

export const addPushNotificationListeners = (
  onReceived: (notification: any) => void,
  onActionPerformed: (action: any) => void
) => {
  if (!isNative()) {
    return;
  }

  PushNotifications.addListener('pushNotificationReceived', onReceived);
  PushNotifications.addListener('pushNotificationActionPerformed', onActionPerformed);
};

export const removePushNotificationListeners = async () => {
  if (!isNative()) {
    return;
  }

  await PushNotifications.removeAllListeners();
};
