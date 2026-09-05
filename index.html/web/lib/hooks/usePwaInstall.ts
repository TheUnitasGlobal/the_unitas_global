'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  getPwaInstallServerSnapshot,
  getPwaInstallSnapshot,
  isIosDevice,
  isMobileDevice,
  promptPwaInstall,
  subscribePwaInstall,
} from '@/lib/pwa/installPrompt';

/**
 * React binding for the global PWA install store (lib/pwa/installPrompt.ts).
 * Every consumer -- nav bar, sealed cinema screen, ad/landing pages, the
 * global <PwaInstallHost/> -- reads ONE shared snapshot, so a component that
 * mounts long after `beforeinstallprompt` fired still sees the captured
 * prompt and can fire it on a single click.
 */
export function usePwaInstall() {
  const snapshot = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallServerSnapshot,
  );
  const [env, setEnv] = useState({ isIos: false, isMobile: false });

  useEffect(() => {
    setEnv({ isIos: isIosDevice(), isMobile: isMobileDevice() });
  }, []);

  const promptInstall = useCallback(async () => {
    await promptPwaInstall();
  }, []);

  return {
    canInstall: Boolean(snapshot.prompt),
    isInstalled: snapshot.installed,
    isIos: env.isIos,
    isMobile: env.isMobile,
    isDesktop: !env.isMobile,
    status: snapshot.status,
    promptInstall,
  };
}
