import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { autoUpdater } from "electron-updater";
import { pathToFileURL } from "node:url";

import { UpdateController } from "./update-controller";

export function setupUpdater(window: BrowserWindow, rendererPath: string) {
  const enabled = app.isPackaged && process.platform === "win32";
  // No release notes, remote error bodies or credentials are forwarded or logged.
  autoUpdater.logger = null;
  const controller = new UpdateController(autoUpdater, enabled, (state) => {
    if (!window.isDestroyed()) window.webContents.send("updates:state", state);
  });
  const rendererUrl = pathToFileURL(rendererPath).href;
  function authorize(event: IpcMainInvokeEvent) {
    const frame = event.senderFrame;
    if (!enabled || window.isDestroyed() || event.sender !== window.webContents ||
        frame !== window.webContents.mainFrame || frame.url.split("#")[0] !== rendererUrl) {
      throw new Error("Atualizacao indisponivel neste contexto.");
    }
  }
  ipcMain.handle("updates:get-state", (event) => { authorize(event); return controller.getState(); });
  ipcMain.handle("updates:download", (event) => { authorize(event); return controller.download(); });
  ipcMain.handle("updates:install", (event) => { authorize(event); return controller.install(); });

  if (enabled) {
    const startup = setTimeout(() => void controller.check(), 10_000);
    const periodic = setInterval(() => void controller.check(), 6 * 60 * 60 * 1000);
    startup.unref();
    periodic.unref();
    window.once("closed", () => { clearTimeout(startup); clearInterval(periodic); });
  }
  window.once("closed", () => {
    for (const channel of ["updates:get-state", "updates:download", "updates:install"]) {
      ipcMain.removeHandler(channel);
    }
  });
}
