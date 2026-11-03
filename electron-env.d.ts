export {};

declare global {
  interface Window {
    asphaltDominion?: {
      platform: NodeJS.Platform;
      getUserDataPath?: () => Promise<string>;
      readTextFile?: (relativePath: string) => Promise<string | null>;
      writeTextFile?: (relativePath: string, contents: string) => Promise<boolean>;
      deleteTextFile?: (relativePath: string) => Promise<boolean>;
      listFiles?: (relativeDir: string) => Promise<string[]>;
      setFullscreen?: (enabled: boolean) => Promise<boolean>;
      getFullscreen?: () => Promise<boolean>;
    };
  }
}
