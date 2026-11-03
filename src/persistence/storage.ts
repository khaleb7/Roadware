import type { HostBridge } from "./types";

const LS_PREFIX = "asphalt-dominion:";

function bridge(): HostBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { asphaltDominion?: HostBridge }).asphaltDominion;
}

/** True when Electron preload exposed file APIs (userData / %APPDATA%). */
export function hasNativeStorage(): boolean {
  const b = bridge();
  return Boolean(b?.readTextFile && b?.writeTextFile);
}

export async function getUserDataPath(): Promise<string | null> {
  const b = bridge();
  if (!b?.getUserDataPath) return null;
  try {
    return await b.getUserDataPath();
  } catch {
    return null;
  }
}

export async function readText(relativePath: string): Promise<string | null> {
  const b = bridge();
  if (b?.readTextFile) {
    try {
      return await b.readTextFile(relativePath);
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(LS_PREFIX + relativePath);
  } catch {
    return null;
  }
}

export async function writeText(relativePath: string, contents: string): Promise<boolean> {
  const b = bridge();
  if (b?.writeTextFile) {
    try {
      return await b.writeTextFile(relativePath, contents);
    } catch {
      return false;
    }
  }
  try {
    localStorage.setItem(LS_PREFIX + relativePath, contents);
    return true;
  } catch {
    return false;
  }
}

export async function deleteText(relativePath: string): Promise<boolean> {
  const b = bridge();
  if (b?.deleteTextFile) {
    try {
      return await b.deleteTextFile(relativePath);
    } catch {
      return false;
    }
  }
  try {
    localStorage.removeItem(LS_PREFIX + relativePath);
    return true;
  } catch {
    return false;
  }
}

export async function setFullscreen(enabled: boolean): Promise<boolean> {
  const b = bridge();
  if (b?.setFullscreen) {
    try {
      return await b.setFullscreen(enabled);
    } catch {
      return false;
    }
  }
  // Web fallback
  try {
    if (enabled && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else if (!enabled && document.fullscreenElement) {
      await document.exitFullscreen();
    }
    return true;
  } catch {
    return false;
  }
}
