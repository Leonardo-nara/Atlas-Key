interface DesktopUpdateState {
  status: "idle" | "available" | "downloading" | "ready" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

interface Window {
  desktopShell?: {
    platform: string;
    updates?: {
      getState(): Promise<DesktopUpdateState>;
      download(): Promise<DesktopUpdateState>;
      install(): Promise<DesktopUpdateState>;
      subscribe(callback: (state: DesktopUpdateState) => void): () => void;
    };
  };
}
