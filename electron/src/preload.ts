import { contextBridge } from 'electron';

// Minimal preload — only expose app version for debugging
contextBridge.exposeInMainWorld('flowpos', {
  version: process.env.npm_package_version ?? '1.4.1',
});
