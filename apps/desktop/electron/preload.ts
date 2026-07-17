import { contextBridge, ipcRenderer } from "electron";

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version: string }
  | {
      status: "downloading";
      version: string;
      percent: number;
      transferred: number;
      total: number;
      bytesPerSecond: number;
    }
  | {
      status: "downloaded";
      version: string;
      releaseName?: string;
      releaseNotes?: string;
    }
  | { status: "not-available"; currentVersion: string }
  | { status: "error"; message: string };

contextBridge.exposeInMainWorld("desktopShell", {
  platform: process.platform
});

contextBridge.exposeInMainWorld("mototake", {
  app: {
    getInfo: () =>
      ipcRenderer.invoke("app:get-info") as Promise<{
        name: string;
        version: string;
        isPackaged: boolean;
      }>
  },
  updates: {
    getState: () => ipcRenderer.invoke("updates:get-state") as Promise<UpdateState>,
    check: () => ipcRenderer.invoke("updates:check") as Promise<UpdateState>,
    install: () => ipcRenderer.invoke("updates:install") as Promise<UpdateState>,
    onState: (callback: (state: UpdateState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) => {
        callback(state);
      };

      ipcRenderer.on("updates:state", listener);

      return () => {
        ipcRenderer.removeListener("updates:state", listener);
      };
    }
  }
});
