; Windows Firewall rule so LAN cashier devices can reach the server without
; depending on the user accepting (or even ever seeing) Windows' one-time
; "allow this app through the firewall" prompt. The installer already runs
; elevated (nsis.perMachine = true), so no extra UAC prompt is triggered here.
!macro customInstall
  DetailPrint "Adding Windows Firewall rule for FlowPOS LAN access..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="FlowPOS"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="FlowPOS" dir=in action=allow program="$INSTDIR\FlowPOS.exe" enable=yes profile=private,domain'
!macroend

!macro customUnInstall
  DetailPrint "Removing Windows Firewall rule for FlowPOS..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="FlowPOS"'
!macroend
