// Prints the current print-only document. Inside the Electron desktop app this
// goes through the main process (window.flowpos.print, exposed by preload.ts) —
// window.print() from a sandboxed renderer can spawn Windows' print dialog with
// no visible window. In a plain browser (e.g. a cashier phone connecting over
// LAN) window.flowpos is undefined, so it falls back to the standard DOM print.
export function triggerPrint(): void {
  const bridge = (window as any).flowpos;
  if (bridge?.print) {
    bridge.print();
  } else {
    window.print();
  }
}
