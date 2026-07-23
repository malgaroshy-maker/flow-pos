import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('flowpos', {
  version: process.env.npm_package_version ?? '1.4.6',
  // Prints via the main process (webContents.print), not the renderer's
  // window.print() — Windows' modern print dialog can spawn with no visible
  // window when triggered from a sandboxed renderer under contextIsolation.
  print: (kind?: 'a4' | 'thermal') => ipcRenderer.invoke('flowpos:print', kind),
  listPrinters: () => ipcRenderer.invoke('flowpos:list-printers'),
  getPrintConfig: () => ipcRenderer.invoke('flowpos:get-print-config'),
  setPrintConfig: (cfg: { a4Printer?: string; thermalPrinter?: string }) =>
    ipcRenderer.invoke('flowpos:set-print-config', cfg),
});

contextBridge.exposeInMainWorld('flowposConfig', {
  get: () => ipcRenderer.invoke('flowpos:get-app-config'),
  save: (cfg: { mode: 'host' | 'client'; serverUrl?: string }) =>
    ipcRenderer.invoke('flowpos:save-app-config', cfg),
});
