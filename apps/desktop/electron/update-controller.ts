export interface UpdateState {
  status: "idle" | "available" | "downloading" | "ready" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

export interface UpdateDriver {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void;
}

export class UpdateController {
  private state: UpdateState = { status: "idle" };
  private checking = false;
  private installing = false;
  private downloading = false;

  constructor(
    private readonly driver: UpdateDriver,
    private readonly enabled: boolean,
    private readonly notify: (state: UpdateState) => void
  ) {
    driver.autoDownload = false;
    driver.autoInstallOnAppQuit = false;
    driver.allowPrerelease = false;
    driver.allowDowngrade = false;
    if (!enabled) return;

    driver.on("update-available", (info) => {
      const version = (info as { version?: unknown })?.version;
      if (typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version)) {
        this.setState({ status: "available", version });
      }
    });
    driver.on("download-progress", (info) => {
      if (!this.downloading) return;
      const percent = (info as { percent?: unknown })?.percent;
      this.setState({
        status: "downloading",
        version: this.state.version,
        percent: typeof percent === "number" && Number.isFinite(percent)
          ? Math.max(0, Math.min(100, percent)) : 0
      });
    });
    driver.on("update-downloaded", () => {
      if (this.downloading) this.setState({ status: "ready", version: this.state.version });
    });
    driver.on("error", () => this.handleError());
  }

  getState(): UpdateState {
    return { ...this.state };
  }

  private setState(state: UpdateState) {
    this.state = state;
    this.notify(this.getState());
  }

  private handleError() {
    // Startup/network checks never interrupt the operator or expose provider errors.
    if (this.downloading) {
      this.setState({
        status: "error", version: this.state.version,
        message: "Nao foi possivel baixar a atualizacao. Tente novamente mais tarde."
      });
    }
  }

  async check() {
    if (!this.enabled || this.checking || this.downloading || this.state.status === "ready") return;
    this.checking = true;
    try { await this.driver.checkForUpdates(); } catch { this.handleError(); }
    finally { this.checking = false; }
  }

  async download(): Promise<UpdateState> {
    if (!this.enabled || this.downloading || !this.state.version ||
        !["available", "error"].includes(this.state.status)) return this.getState();
    this.downloading = true;
    this.setState({ status: "downloading", version: this.state.version, percent: 0 });
    try { await this.driver.downloadUpdate(); } catch { this.handleError(); }
    finally { this.downloading = false; }
    return this.getState();
  }

  install(): UpdateState {
    if (!this.enabled || this.installing || this.state.status !== "ready") return this.getState();
    this.installing = true;
    // Let the IPC response reach the renderer before closing its window.
    setImmediate(() => {
      try { this.driver.quitAndInstall(false, true); }
      catch {
        this.installing = false;
        this.setState({ ...this.state, message: "Nao foi possivel reiniciar. Tente novamente." });
      }
    });
    return this.getState();
  }
}
