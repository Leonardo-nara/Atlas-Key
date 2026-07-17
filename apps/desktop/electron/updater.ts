import { app, BrowserWindow, ipcMain } from "electron";
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from "electron-updater";
import { autoUpdater } from "electron-updater";

export type UpdateState =
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

const UPDATE_CHECK_DELAY_MS = 10_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_RELEASE_NOTES_LENGTH = 1_500;

let currentState: UpdateState = { status: "idle" };
let checkInFlight: Promise<UpdateState> | null = null;
let installInProgress = false;
let pendingVersion: string | null = null;
let initialized = false;

function isUpdaterEnabled() {
  return app.isPackaged && process.env.MOTOTAKE_DISABLE_AUTO_UPDATE !== "true";
}

function sanitizeError(error: unknown) {
  const fallback = "Nao foi possivel verificar atualizacoes agora.";

  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  return error.message
    .replace(/https?:\/\/\S+/gi, "[url-removida]")
    .replace(/token=[^\s&]+/gi, "token=[removido]")
    .replace(/(authorization|password|secret|token):\s*[^\s]+/gi, "$1: [removido]")
    .slice(0, 240);
}

function sanitizeReleaseNotes(notes: UpdateDownloadedEvent["releaseNotes"]) {
  if (!notes) {
    return undefined;
  }

  const rawNotes = Array.isArray(notes)
    ? notes.map((note) => note.note).filter(Boolean).join("\n\n")
    : String(notes);

  return rawNotes.slice(0, MAX_RELEASE_NOTES_LENGTH);
}

function setState(state: UpdateState) {
  currentState = state;

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("updates:state", currentState);
  }
}

async function runCheckForUpdates() {
  if (!isUpdaterEnabled()) {
    setState({ status: "not-available", currentVersion: app.getVersion() });
    return currentState;
  }

  if (currentState.status === "downloaded") {
    return currentState;
  }

  if (checkInFlight) {
    return checkInFlight;
  }

  checkInFlight = autoUpdater
    .checkForUpdates()
    .then(() => currentState)
    .catch((error: unknown) => {
      setState({ status: "error", message: sanitizeError(error) });
      return currentState;
    })
    .finally(() => {
      checkInFlight = null;
    });

  return checkInFlight;
}

function handleUpdateAvailable(info: UpdateInfo) {
  pendingVersion = info.version;
  setState({ status: "available", version: info.version });
}

function handleDownloadProgress(progress: ProgressInfo) {
  setState({
    status: "downloading",
    version: pendingVersion ?? "nova versao",
    percent: Math.max(0, Math.min(100, progress.percent)),
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond
  });
}

function handleUpdateDownloaded(info: UpdateDownloadedEvent) {
  pendingVersion = info.version;
  setState({
    status: "downloaded",
    version: info.version,
    releaseName: info.releaseName ?? undefined,
    releaseNotes: sanitizeReleaseNotes(info.releaseNotes)
  });
}

function installDownloadedUpdate() {
  if (installInProgress || currentState.status !== "downloaded") {
    return currentState;
  }

  installInProgress = true;
  autoUpdater.quitAndInstall(false, true);
  return currentState;
}

export function registerUpdaterIpc() {
  ipcMain.handle("app:get-info", () => ({
    name: app.getName(),
    version: app.getVersion(),
    isPackaged: app.isPackaged
  }));

  ipcMain.handle("updates:get-state", () => currentState);
  ipcMain.handle("updates:check", () => runCheckForUpdates());
  ipcMain.handle("updates:install", () => installDownloadedUpdate());
}

export function initAutoUpdater() {
  if (initialized) {
    return;
  }

  initialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on("checking-for-update", () => setState({ status: "checking" }));
  autoUpdater.on("update-available", handleUpdateAvailable);
  autoUpdater.on("update-not-available", () => {
    setState({ status: "not-available", currentVersion: app.getVersion() });
  });
  autoUpdater.on("download-progress", handleDownloadProgress);
  autoUpdater.on("update-downloaded", handleUpdateDownloaded);
  autoUpdater.on("error", (error: unknown) => {
    setState({ status: "error", message: sanitizeError(error) });
  });

  if (!isUpdaterEnabled()) {
    return;
  }

  setTimeout(() => {
    void runCheckForUpdates();
  }, UPDATE_CHECK_DELAY_MS);

  setInterval(() => {
    void runCheckForUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);
}
