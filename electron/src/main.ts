import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  Menu,
  shell,
  Tray,
} from 'electron';
import { ChildProcess, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ─── Paths ───────────────────────────────────────────────────────────────────

const IS_PACKAGED = app.isPackaged;

const APP_ROOT = app.getAppPath();
const SERVER_SCRIPT = join(APP_ROOT, 'dist', 'server.js');

// Data directory: survives upgrades, doesn't need admin to write.
// Electron's app.getPath() has no machine-wide "ProgramData" entry, so read it
// from the environment (always set on Windows) instead of faking it off
// getPath('appData') + '..' + 'ProgramData', which landed inside the user's own
// C:\Users\<user>\AppData\ProgramData — a directory Windows never creates.
const COMMON_APP_DATA = process.env.ProgramData || join(app.getPath('appData'), '..');
const DATA_DIR = join(COMMON_APP_DATA, 'FlowPOS', 'data');
const DB_PATH = join(DATA_DIR, 'pos.db');

const PORT = 3001;
const SERVER_URL = `http://localhost:${PORT}`;

// app.getAppPath() returns the path to the app directory in both dev and packaged mode.
// Assets are placed in assets/ relative to the app root.
const ASSETS_DIR = join(APP_ROOT, 'assets');

const TRAY_ICON_PATH = join(ASSETS_DIR, 'tray-icon.png');
const APP_ICON_PATH = join(ASSETS_DIR, 'icon.ico');

// ─── State ────────────────────────────────────────────────────────────────────

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverReady = false;
let isQuitting = false;

// ─── Splash Screen ────────────────────────────────────────────────────────────

// Splash is placed in resources/ via extraFiles in packaged mode
const SPLASH_HTML_PATH = IS_PACKAGED
  ? join(process.resourcesPath, 'splash.html')
  : join(APP_ROOT, 'assets', 'splash.html');

function createSplashWindow() {
  const iconPath = existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined;

  splashWindow = new BrowserWindow({
    width: 480,
    height: 520,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(SPLASH_HTML_PATH);
  splashWindow.on('closed', () => { splashWindow = null; });
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  splashWindow = null;
}

// ─── Server Management ────────────────────────────────────────────────────────

function findNodeExecutable(): string {
  if (IS_PACKAGED) {
    // electron-builder bundles Node.js next to the executable
    const candidates = [
      join(process.execPath, '..', 'resources', 'node', 'node.exe'),
      join(process.execPath, '..', 'node.exe'),
      join(process.resourcesPath, 'node', 'node.exe'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    // Fallback: use the embedded Node.js from Electron itself (runs Node scripts)
    return process.execPath; // Electron can run Node scripts with --version flag for sanity
  }
  // Dev mode: use system node
  return 'node';
}

let serverLogBuffer = '';
const LOG_FILE = join(DATA_DIR, 'server.log');

function logServer(text: string) {
  const line = `[${new Date().toISOString()}] ${text}\n`;
  serverLogBuffer += line;
  try {
    appendFileSync(LOG_FILE, line, 'utf-8');
  } catch {}
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = httpGet(`http://localhost:${port}/api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200 || (res.statusCode !== undefined && res.statusCode < 500));
    });
    probe.on('error', () => resolve(false));
    probe.end();
  });
}

function startServer(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    serverReady = false;
    serverLogBuffer = '';

    // Ensure data directory exists
    mkdirSync(DATA_DIR, { recursive: true });

    process.env.POS_DB_PATH = DB_PATH;
    process.env.POS_PORT = String(PORT);
    process.env.POS_HOST = '0.0.0.0';
    process.env.NODE_ENV = 'production';

    logServer(`Starting server in main process: ${SERVER_SCRIPT}`);
    logServer(`DB path: ${DB_PATH}`);

    try {
      // Check if server is already running (e.g., from a previous instance)
      const alreadyRunning = await isPortInUse(PORT);
      if (alreadyRunning) {
        logServer(`Port ${PORT} already in use — reusing existing server`);
        waitForServer(resolve, reject);
        return;
      }

      // Import and execute the compiled Fastify server bundle inside Electron main process
      await import(SERVER_SCRIPT);
      // Give Fastify 2s to bind to the port before first poll
      setTimeout(() => waitForServer(resolve, reject), 2000);
    } catch (err: any) {
      logServer(`Server start error: ${err?.stack || err}`);
      reject(err);
    }
  });
}

function waitForServer(
  resolve: () => void,
  reject: (err: Error) => void,
  attempt = 0
) {
  const MAX_ATTEMPTS = 120; // 60 seconds total
  if (attempt >= MAX_ATTEMPTS) {
    reject(new Error('Server did not start within 60 seconds'));
    return;
  }

  const probe = httpGet(`${SERVER_URL}/api/health`, (res) => {
    // 200 = healthy, 401 = server up but auth required — either means it's running
    if (res.statusCode === 200 || res.statusCode === 401) {
      serverReady = true;
      updateTrayMenu();
      resolve();
    } else {
      setTimeout(() => waitForServer(resolve, reject, attempt + 1), 500);
    }
    res.resume(); // Consume response data to free up memory
  });

  probe.on('error', () => {
    setTimeout(() => waitForServer(resolve, reject, attempt + 1), 500);
  });
  probe.end();
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!serverProcess || serverProcess.exitCode !== null) {
      resolve();
      return;
    }
    serverProcess.once('exit', () => resolve());
    serverProcess.kill('SIGTERM');
    // Force kill after 5s
    setTimeout(() => {
      if (serverProcess && serverProcess.exitCode === null) {
        serverProcess.kill('SIGKILL');
      }
      resolve();
    }, 5000);
  });
}

async function restartServer() {
  console.log('[FlowPOS] Restarting server...');
  serverReady = false;
  updateTrayMenu();
  await stopServer();
  try {
    await startServer();
    mainWindow?.reload();
    updateTrayMenu();
  } catch (err) {
    console.error('[FlowPOS] Server restart failed:', err);
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createMainWindow() {
  const iconPath = existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'منظومة Flow للمبيعات والمخزون',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // Show a clean loading state
    show: false,
    backgroundColor: '#0f172a',
  });

  // Remove default menu bar
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  // Open DevTools only in dev mode
  if (!IS_PACKAGED) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
    mainWindow!.focus();
  });

  // Prevent window from being destroyed on close — minimize to tray instead
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow!.hide();
      tray?.displayBalloon({
        title: 'منظومة Flow',
        content: 'المنظومة لا تزال تعمل في شريط النظام. انقر على الأيقونة للعودة.',
        iconType: 'info',
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(SERVER_URL);
}

function openOrFocusWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function buildTrayMenu(): Menu {
  const statusLabel = serverReady ? '● الخادم يعمل' : '○ الخادم متوقف';

  return Menu.buildFromTemplate([
    {
      label: 'فتح منظومة Flow',
      click: openOrFocusWindow,
      type: 'normal',
    },
    { type: 'separator' },
    {
      label: statusLabel,
      enabled: false,
    },
    {
      label: 'إعادة تشغيل الخادم',
      click: () => restartServer(),
    },
    { type: 'separator' },
    {
      label: 'فتح مجلد البيانات',
      click: () => shell.openPath(DATA_DIR),
    },
    { type: 'separator' },
    {
      label: 'إغلاق منظومة Flow',
      click: quitApp,
    },
  ]);
}

function updateTrayMenu() {
  if (tray) {
    tray.setContextMenu(buildTrayMenu());
    tray.setToolTip(
      serverReady
        ? 'منظومة Flow — تعمل على المنفذ 3001'
        : 'منظومة Flow — الخادم متوقف'
    );
  }
}

function createTray() {
  let icon: Electron.NativeImage;

  if (existsSync(TRAY_ICON_PATH)) {
    icon = nativeImage.createFromPath(TRAY_ICON_PATH);
  } else {
    // Fallback: create a minimal 16×16 colored icon programmatically
    icon = nativeImage.createFromDataURL(
      // 16x16 green circle as base64 PNG
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAf0lEQVQ4jWNgGAWjAAiA+P9RgAEI/kMZDAyMWDlgYGCQxVc' +
      'gJSWlRLCCgYGBBRMYGBgYGHBhFgYGBgyYGBgYGDJgYGCQwMDAIA8TMzAweGBiMDBgYGDAgIGBAQMGBgYMDAwMGBgYGDAwMGBgYGBgYmBgwMCAgYEBAwMDAwBQTxAbCqSoOwAAAABJRU5ErkJggg=='
    );
  }

  tray = new Tray(icon);
  tray.setToolTip('منظومة Flow — جاري التشغيل...');
  tray.setContextMenu(buildTrayMenu());

  // Double-click opens the window
  tray.on('double-click', openOrFocusWindow);
}

// ─── Printing ─────────────────────────────────────────────────────────────────

// On some debloated/OEM-trimmed Windows images, the built-in Print UI
// package (Windows.PrintDialog) exists on disk but isn't registered for the
// current user — window.print()/webContents.print() then spawn a windowless
// PrintDialog.exe process instead of a visible dialog, so printing silently
// does nothing. Re-registering it is a cheap, per-user, non-admin operation
// that's a no-op if the package is already fine. Fire-and-forget at startup.
function ensurePrintDialogRegistered() {
  if (process.platform !== 'win32') return;
  const manifestPath =
    'C:\\Windows\\SystemApps\\Windows.PrintDialog_cw5n1h2txyewy\\AppxManifest.xml';
  const ps = [
    '-NoProfile',
    '-Command',
    `if (-not (Get-AppxPackage -Name 'Windows.PrintDialog')) { ` +
      `try { Add-AppxPackage -DisableDevelopmentMode -Register '${manifestPath}' } catch {} }`,
  ];
  try {
    const proc = spawn('powershell.exe', ps, { windowsHide: true, stdio: 'ignore' });
    proc.on('error', () => {}); // best-effort — never block startup on this
  } catch {}
}

// Printer selection persists across restarts in a small JSON file next to the
// DB — not in the server's settings table, since this is a per-machine
// Electron concern (each cashier device could have a different printer),
// not shared business data.
interface PrintConfig {
  a4Printer?: string;
  thermalPrinter?: string;
}

const PRINT_CONFIG_PATH = join(DATA_DIR, 'print-config.json');

function loadPrintConfig(): PrintConfig {
  try {
    return JSON.parse(readFileSync(PRINT_CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function savePrintConfig(cfg: PrintConfig) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(PRINT_CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch {}
}

ipcMain.handle('flowpos:list-printers', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return [];
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({ name: p.name, displayName: p.displayName }));
  } catch {
    return [];
  }
});

ipcMain.handle('flowpos:get-print-config', async () => loadPrintConfig());

ipcMain.handle('flowpos:set-print-config', async (_event, cfg: PrintConfig) => {
  const merged = { ...loadPrintConfig(), ...cfg };
  savePrintConfig(merged);
  return merged;
});

// Triggered from the renderer's window.flowpos.print() (preload.ts) instead of
// window.print() — see the comment there for why. Prints silently (no OS
// dialog): the interactive Windows print dialog was confirmed, via testing on
// this machine, to (a) sometimes launch with no visible window at all
// (see ensurePrintDialogRegistered above) and (b) ignore the requested
// portrait/A4 orientation even when it does render — both are platform
// limitations of Electron's legacy-GDI print path on Windows, not fixable by
// passing different options. Silent printing sidesteps both entirely and
// matches the "kiosk print, no dialog" behavior docs/design.md specifies.
ipcMain.handle('flowpos:print', async (event, kind?: 'a4' | 'thermal') => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, reason: 'no_window' };
  const cfg = loadPrintConfig();
  const deviceName = kind === 'thermal' ? cfg.thermalPrinter : cfg.a4Printer;
  const base = { silent: true, printBackground: true, landscape: false };
  const options =
    kind === 'thermal'
      ? { ...base, ...(deviceName ? { deviceName } : {}) }
      : { ...base, pageSize: 'A4' as const, ...(deviceName ? { deviceName } : {}) };
  return new Promise<{ success: boolean; reason?: string }>((resolvePrint) => {
    win.webContents.print(options, (success, reason) => {
      resolvePrint({ success, reason });
    });
  });
});

// ─── App Lifecycle ────────────────────────────────────────────────────────────

function quitApp() {
  isQuitting = true;
  mainWindow?.destroy();
  stopServer().then(() => app.quit());
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    openOrFocusWindow();
  });

  app.whenReady().then(async () => {
    // Auto-start with Windows on login
    if (IS_PACKAGED) {
      app.setLoginItemSettings({
        openAtLogin: true,
        name: 'FlowPOS',
      });
    }

    ensurePrintDialogRegistered();

    // Show splash screen immediately while server starts
    createSplashWindow();

    // Create tray so user sees something even during startup
    createTray();

    // Start the Fastify server
    try {
      await startServer();
      console.log('[FlowPOS] Server ready at', SERVER_URL);
    } catch (err: any) {
      console.error('[FlowPOS] Server failed to start:', err);
      dialog.showErrorBox(
        'خطأ في تشغيل خادم المنظومة',
        `تعذر تشغيل الخادم المحلي على هذا الجهاز.\n\nالخطأ: ${err?.message || err}\n\nسجل الخادم:\n${serverLogBuffer.slice(-1500) || 'لا توجد مخرجات'}`
      );
    }

    // Close splash and open main window
    closeSplashWindow();
    createMainWindow();
    updateTrayMenu();
  });
}

// Prevent app from quitting when all windows are closed (we live in the tray)
app.on('window-all-closed', () => {
  // On macOS this is normal; on Windows/Linux we stay in tray
  if (!isQuitting) {
    // Do nothing — app continues via system tray
  }
});

app.on('activate', () => {
  openOrFocusWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

// Handle unexpected exits gracefully
process.on('uncaughtException', (err) => {
  console.error('[FlowPOS] Uncaught exception:', err);
});
