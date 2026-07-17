import { useCallback, useEffect, useState } from "react";

interface DesktopAppInfo {
  name: string;
  version: string;
  isPackaged: boolean;
}

export function useDesktopUpdates() {
  const updatesApi = window.mototake?.updates;
  const appApi = window.mototake?.app;
  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!updatesApi || !appApi) {
      return;
    }

    let active = true;

    void appApi.getInfo().then((info) => {
      if (active) {
        setAppInfo(info);
      }
    });

    void updatesApi.getState().then((state) => {
      if (active) {
        setUpdateState(state);
      }
    });

    const unsubscribe = updatesApi.onState((state) => {
      setUpdateState(state);

      if (state.status === "checking" || state.status === "not-available" || state.status === "error") {
        setLastCheckedAt(new Date().toISOString());
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [appApi, updatesApi]);

  const checkForUpdates = useCallback(async () => {
    if (!updatesApi) {
      return;
    }

    setLastCheckedAt(new Date().toISOString());
    setUpdateState(await updatesApi.check());
  }, [updatesApi]);

  const installUpdate = useCallback(async () => {
    if (!updatesApi || updateState.status !== "downloaded") {
      return;
    }

    await updatesApi.install();
  }, [updateState.status, updatesApi]);

  return {
    isDesktop: Boolean(updatesApi && appApi),
    appInfo,
    updateState,
    lastCheckedAt,
    checkForUpdates,
    installUpdate
  };
}

