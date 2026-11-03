import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const DEV_SERVER_URL = "http://localhost:5173";

/** Design target 1080p; window opens at 1280×720 letterboxed via Phaser FIT. */
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

let mainWindow: BrowserWindow | null = null;

function userDataFile(relativePath: string): string {
  // Windows: %APPDATA%/<appName>/… via Electron userData
  return path.join(app.getPath("userData"), relativePath);
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: "#0b0d10",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = win;

  win.once("ready-to-show", () => {
    win.show();
  });

  if (isDev) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle("ad:get-user-data-path", () => app.getPath("userData"));

  ipcMain.handle("ad:read-text-file", async (_e, relativePath: string) => {
    try {
      const full = userDataFile(relativePath);
      return await fs.readFile(full, "utf8");
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    "ad:write-text-file",
    async (_e, relativePath: string, contents: string) => {
      try {
        const full = userDataFile(relativePath);
        await ensureParentDir(full);
        await fs.writeFile(full, contents, "utf8");
        return true;
      } catch {
        return false;
      }
    },
  );

  ipcMain.handle("ad:delete-text-file", async (_e, relativePath: string) => {
    try {
      await fs.unlink(userDataFile(relativePath));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("ad:list-files", async (_e, relativeDir: string) => {
    try {
      const full = userDataFile(relativeDir);
      return await fs.readdir(full);
    } catch {
      return [];
    }
  });

  ipcMain.handle("ad:set-fullscreen", (_e, enabled: boolean) => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!win) return false;
    win.setFullScreen(Boolean(enabled));
    return win.isFullScreen();
  });

  ipcMain.handle("ad:get-fullscreen", () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    return win?.isFullScreen() ?? false;
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
