import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { PushPayload } from "./db";

export const getPermissionGranted = async (): Promise<boolean> => {
  const isGranted = localStorage.getItem("permission_granted");

  if (isGranted === "true") {
    return true;
  }

  let granted = await isPermissionGranted();

  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }

  if (granted) {
    localStorage.setItem("permission_granted", "true");
  }

  return granted;
};

export const formatTitle = (message: PushPayload) => {
  const parts = [];

  if (message.pusher) parts.push(message.pusher);
  if (message.type) parts.push(message.type);
  if (message.date) parts.push(`@${message.date}`);

  // 如果所有都没有，就用默认
  return parts.length > 0 ? parts.join(" ") : "Notification";
};

export const sendPushPayload = async (payload: PushPayload) => {
  const permission = await getPermissionGranted();
  if (permission) {
    // sendNotification({ title: "Hello", body: "Tauri is awesome!" });
    sendNotification({
      title: formatTitle(payload),
      body: payload.msg,
      sound: "default",
      icon: "assets/icon.png",
      largeIcon: "assets/icon.png",
    });
  }
};
