export {};

declare global {
  interface Window {
    asphaltDominion?: {
      platform: NodeJS.Platform;
    };
  }
}
