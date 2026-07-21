import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('flowpos', {
  version: process.env.npm_package_version ?? '1.4.3',
  // Prints via the main process (webContents.print), not the renderer's
  // window.print() — Windows' modern print dialog can spawn with no visible
  // window when triggered from a sandboxed renderer under contextIsolation.
  print: (kind?: 'a4' | 'thermal') => ipcRenderer.invoke('flowpos:print', kind),
});
