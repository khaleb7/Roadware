/**
 * Preload bridge — keep empty for Milestone 1.
 * Future: expose a narrow, typed API via contextBridge for saves/settings.
 */
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("asphaltDominion", {
  platform: process.platform,
});
