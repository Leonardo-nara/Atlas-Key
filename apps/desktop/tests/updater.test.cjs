const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { UpdateController } = require("../dist-electron/electron/update-controller.js");

class Driver extends EventEmitter {
  checks = 0;
  downloads = 0;
  installs = 0;
  async checkForUpdates() { this.checks++; if (this.offline) throw new Error("private network details"); }
  async downloadUpdate() {
    this.downloads++;
    if (this.failDownload) { this.emit("error", new Error("secret provider response")); throw new Error("secret"); }
    this.emit("download-progress", { percent: 54 });
    this.emit("update-downloaded", { version: "1.0.2" });
  }
  quitAndInstall(silent, runAfter) { this.installs++; assert.equal(silent, false); assert.equal(runAfter, true); }
}

test("development never checks, downloads or installs", async () => {
  const driver = new Driver();
  const controller = new UpdateController(driver, false, () => {});
  await controller.check(); await controller.download(); controller.install();
  assert.equal(driver.checks + driver.downloads + driver.installs, 0);
});

test("startup checks do not download; no update and offline remain silent", async () => {
  const driver = new Driver();
  const controller = new UpdateController(driver, true, () => {});
  await controller.check();
  driver.offline = true;
  await controller.check();
  assert.equal(controller.getState().status, "idle");
  assert.equal(driver.downloads, 0);
  assert.equal(driver.autoDownload, false);
  assert.equal(driver.autoInstallOnAppQuit, false);
  assert.equal(driver.allowPrerelease, false);
  assert.equal(driver.allowDowngrade, false);
});

test("click downloads once, reports progress, and explicit install runs once", async () => {
  const driver = new Driver();
  const states = [];
  const controller = new UpdateController(driver, true, (state) => states.push(state));
  driver.emit("update-available", { version: "1.0.2", releaseNotes: "not exposed" });
  assert.deepEqual(controller.getState(), { status: "available", version: "1.0.2" });
  assert.equal(driver.downloads, 0);
  controller.install();
  assert.equal(driver.installs, 0);
  await Promise.all([controller.download(), controller.download()]);
  assert.equal(driver.downloads, 1);
  assert(states.some((state) => state.percent === 54));
  assert.equal(controller.getState().status, "ready");
  controller.install(); controller.install();
  await new Promise(setImmediate);
  assert.equal(driver.installs, 1);
});

test("download failure is sanitized and retry succeeds", async () => {
  const driver = new Driver();
  const controller = new UpdateController(driver, true, () => {});
  driver.emit("update-available", { version: "1.0.2" });
  driver.failDownload = true;
  await controller.download();
  assert.equal(controller.getState().status, "error");
  assert(!JSON.stringify(controller.getState()).includes("secret"));
  driver.failDownload = false;
  await controller.download();
  assert.equal(controller.getState().status, "ready");
});

test("unknown versions and unsolicited download events are ignored", () => {
  const driver = new Driver();
  const controller = new UpdateController(driver, true, () => {});
  driver.emit("update-available", { version: "<script>" });
  driver.emit("download-progress", { percent: NaN });
  driver.emit("update-downloaded", { version: "1.0.2" });
  assert.equal(controller.getState().status, "idle");
});

test("concurrent checks use a single request", async () => {
  const driver = new Driver();
  driver.checkForUpdates = async () => { driver.checks++; await new Promise(setImmediate); };
  const controller = new UpdateController(driver, true, () => {});
  await Promise.all([controller.check(), controller.check()]);
  assert.equal(driver.checks, 1);
});

test("explicit IPC is bound to the packaged main frame, never remote content", async () => {
  const Module = require("node:module");
  const originalLoad = Module._load;
  const handlers = new Map();
  const rendererPath = path.resolve("dist/index.html");
  const frame = { url: require("node:url").pathToFileURL(rendererPath).href + "#/dashboard" };
  const webContents = { mainFrame: frame, send() {} };
  const window = new EventEmitter();
  window.webContents = webContents;
  window.isDestroyed = () => false;
  const driver = new Driver();
  const app = { isPackaged: true };
  Module._load = function(id, ...args) {
    if (id === "electron") return { app, ipcMain: { handle: (name, handler) => handlers.set(name, handler), removeHandler: (name) => handlers.delete(name) } };
    if (id === "electron-updater") return { autoUpdater: driver };
    return originalLoad.call(this, id, ...args);
  };
  try {
    const { setupUpdater } = require("../dist-electron/electron/updater.js");
    setupUpdater(window, rendererPath);
    assert.equal(handlers.size, 3);
    const getState = handlers.get("updates:get-state");
    assert.throws(() => getState({ sender: {}, senderFrame: frame }));
    assert.throws(() => getState({ sender: webContents, senderFrame: { url: frame.url } }));
    assert.equal(getState({ sender: webContents, senderFrame: frame }).status, "idle");
    frame.url = "https://example.invalid";
    assert.throws(() => getState({ sender: webContents, senderFrame: frame }));
    frame.url = require("node:url").pathToFileURL(rendererPath).href;
    app.isPackaged = false;
    // A fresh dev setup has no scheduled checks and rejects all updater IPC.
    window.emit("closed");
    setupUpdater(window, rendererPath);
    assert.throws(() => handlers.get("updates:download")({ sender: webContents, senderFrame: frame }));
    window.emit("closed");
  } finally { Module._load = originalLoad; }
});

test("packaging preserves app identity/data and only a public GitHub feed", () => {
  const config = require("../package.json");
  assert.equal(config.name, "@deliveries/desktop");
  assert.equal(config.build.appId, "com.mototake.desktop");
  assert.equal(config.build.nsis.deleteAppDataOnUninstall, false);
  assert.equal(config.build.publish.provider, "github");
  assert.equal(config.build.publish.repo, "Atlas-Key");
  assert.equal(config.build.publish.tagNamePrefix, "desktop-v");
  assert.equal(config.build.publish.token, undefined);
  const main = fs.readFileSync(path.join(__dirname, "../electron/main.ts"), "utf8");
  assert(main.includes("contextIsolation: true"));
  assert(main.includes("nodeIntegration: false"));
  assert(main.includes("sandbox: true"));
  assert(!main.includes("setPath("));
});

test("real GitHub provider resolves desktop-prefixed stable release and standard manifest", async () => {
  const { GitHubProvider } = require("electron-updater/out/providers/GitHubProvider");
  const options = require("../package.json").build.publish;
  const calls = [];
  const provider = new GitHubProvider(options, {
    allowPrerelease: false, channel: null, currentVersion: "1.0.1", fullChangelog: false
  }, {
    platform: "win32",
    executor: { request: async (options) => {
      calls.push(options);
      assert(options.path.endsWith("/desktop-v1.0.2/latest.yml"));
      return "version: 1.0.2\nfiles:\n  - url: Mototake-Setup-1.0.2.exe\n    sha512: testhash\n";
    } }
  });
  provider.httpRequest = async (url) => {
    calls.push(url.href);
    if (url.pathname.endsWith(".atom")) return '<feed><entry><title>Mototake 1.0.2</title><link href="https://github.com/Leonardo-nara/Atlas-Key/releases/tag/desktop-v1.0.2"/><content>Nova versao</content></entry></feed>';
    assert.equal(url.href, "https://github.com/Leonardo-nara/Atlas-Key/releases/latest");
    return JSON.stringify({ tag_name: "desktop-v1.0.2" });
  };
  const info = await provider.getLatestVersion();
  assert.equal(info.version, "1.0.2");
  const files = provider.resolveFiles(info);
  assert.equal(files[0].url.href, "https://github.com/Leonardo-nara/Atlas-Key/releases/download/desktop-v1.0.2/Mototake-Setup-1.0.2.exe");
  assert(!JSON.stringify(calls).includes("authorization"));
});
