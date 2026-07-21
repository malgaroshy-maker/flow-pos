export type PrintKind = 'a4' | 'thermal';

// Prints the current print-only document. Inside the Electron desktop app this
// goes through the main process (window.flowpos.print, exposed by preload.ts) —
// window.print() from a sandboxed renderer can spawn Windows' print dialog with
// no visible window. In a plain browser (e.g. a cashier phone connecting over
// LAN) window.flowpos is undefined, so it falls back to the standard DOM print.
//
// `kind` tells the main process how to size the page: A4 documents (invoices,
// quotations, statements, reports) need portrait A4, not the dialog's own
// landscape default; thermal receipts print at whatever the roll printer's
// driver already provides, so no size is forced.
export function triggerPrint(kind: PrintKind = 'a4'): void {
  const bridge = (window as any).flowpos;
  if (bridge?.print) {
    bridge.print(kind);
  } else {
    window.print();
  }
}
