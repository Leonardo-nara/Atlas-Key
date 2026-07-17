interface Window {
  desktopShell?: {
    platform: string;
  };
  mototake?: {
    app: {
      getInfo: () => Promise<{
        name: string;
        version: string;
        isPackaged: boolean;
      }>;
    };
    secureSession?: {
      get: () => Promise<{
        accessToken: string;
        refreshToken: string;
      } | null>;
      set: (tokens: { accessToken: string; refreshToken: string }) => Promise<boolean>;
      clear: () => Promise<boolean>;
    };
    updates: {
      getState: () => Promise<UpdateState>;
      check: () => Promise<UpdateState>;
      install: () => Promise<UpdateState>;
      onState: (callback: (state: UpdateState) => void) => () => void;
    };
  };
}

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
