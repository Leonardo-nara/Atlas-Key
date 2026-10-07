import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { UpdateState } from "./update-controller";

contextBridge.exposeInMainWorld("desktopShell", {
  platform: process.platform,
  updates: {
    getState: (): Promise<UpdateState> => ipcRenderer.invoke("updates:get-state"),
    download: (): Promise<UpdateState> => ipcRenderer.invoke("updates:download"),
    install: (): Promise<UpdateState> => ipcRenderer.invoke("updates:install"),
    subscribe: (callback: (state: UpdateState) => void) => {
      const listener = (_event: IpcRendererEvent, state: UpdateState) => callback(state);
      ipcRenderer.on("updates:state", listener);
      return () => ipcRenderer.removeListener("updates:state", listener);
    }
  }
});
