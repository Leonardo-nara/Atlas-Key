import { app, BrowserWindow } from "electron";
import path from "node:path";

const isDev = !app.isPackaged;
const bundledRendererPath = path.join(__dirname, "../../dist/index.html");

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error(`Renderer failed to load (${code}): ${description} - ${url}`);
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  const shouldUseDevServer = Boolean(rendererUrl?.startsWith("http"));

  if (shouldUseDevServer) {
    void window.loadURL(rendererUrl!);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  if (rendererUrl?.startsWith("file://")) {
    void window.loadURL(rendererUrl);
    return;
  }

  if (isDev) {
    void window.loadURL("http://localhost:5173");
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void window.loadFile(bundledRendererPath);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
