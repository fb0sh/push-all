import { LazyStore } from "@tauri-apps/plugin-store";

export const appStore = new LazyStore("appStore.json");

export const setToken = async (token: string) => {
  await appStore.set("token", token);
};

export const getToken = async (): Promise<string | null> => {
  return (await appStore.get<string>("token")) ?? null;
};

export const setPushWs = async (wsUri: string) => {
  await appStore.set("push_ws_uri", wsUri);
};

export const getPushWs = async (): Promise<string | null> => {
  return (await appStore.get<string>("push_ws_uri")) ?? null;
};
