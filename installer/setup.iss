; =====================================================================
; Inno Setup Script for منظومة Flow (Offline POS & Inventory System)
; Version: 1.4.0 Commercial Packaging
; =====================================================================

#define MyAppName "منظومة Flow للمبيعات والمخزون"
#define MyAppVersion "1.4.0"
#define MyAppPublisher "Flow POS Solutions"
#define MyAppURL "http://localhost:3001"
#define MyAppExeName "FlowPOS.exe"

[Setup]
AppId={{D37E88B9-A6C7-4F62-8E3A-9E6D383F0014}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\FlowPOS
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=
OutputDir=..\dist-installer
OutputBaseFilename=FlowPOS_Setup_v1.4.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Server compiled bundle & web dist
Source: "..\server\dist\server.js"; DestDir: "{app}\server\dist"; Flags: ignoreversion
Source: "..\server\drizzle\*"; DestDir: "{app}\server\drizzle"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\web\dist\*"; DestDir: "{app}\web\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; Native SQLite binary bindings & node modules
Source: "..\server\node_modules\better-sqlite3\*"; DestDir: "{app}\server\node_modules\better-sqlite3"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{#MyAppURL}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{#MyAppURL}"; Tasks: desktopicon

[Run]
; Open Windows Firewall Rule for LAN access on Port 3001
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""FlowPOS Server"" dir=in action=allow protocol=TCP localport=3001"; Flags: runhidden

; Open browser upon installation finish
Filename: "explorer.exe"; Parameters: "{#MyAppURL}"; Flags: postinstall shellexec skipifsilent Description: "فتح منظومة Flow في المتصفح"

[UninstallRun]
; Remove Windows Firewall Rule on uninstall
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""FlowPOS Server"""; Flags: runhidden
