/**
 * Narrow typed bridge: saves/settings under Electron userData (%APPDATA% on Windows).
 * Renderer falls back to localStorage when these APIs are absent (web/dev browser).
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("asphaltDominion", {
  platform: process.platform,
  getUserDataPath: (): Promise<string> => ipcRenderer.invoke("ad:get-user-data-path"),
  readTextFile: (relativePath: string): Promise<string | null> =>
    ipcRenderer.invoke("ad:read-text-file", relativePath),
  writeTextFile: (relativePath: string, contents: string): Promise<boolean> =>
    ipcRenderer.invoke("ad:write-text-file", relativePath, contents),
  deleteTextFile: (relativePath: string): Promise<boolean> =>
    ipcRenderer.invoke("ad:delete-text-file", relativePath),
  listFiles: (relativeDir: string): Promise<string[]> =>
    ipcRenderer.invoke("ad:list-files", relativeDir),
  setFullscreen: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke("ad:set-fullscreen", enabled),
  getFullscreen: (): Promise<boolean> => ipcRenderer.invoke("ad:get-fullscreen"),
});
