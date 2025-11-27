; Service Manager Script for Telco ADB Automation
!include "install-service.nsh"

; Custom install section
Section "InstallService" SEC01
  Call InstallService
SectionEnd

; Custom uninstall section
Section "Uninstall"
  Call un.UninstallService
SectionEnd

; Add registry entries for service management
WriteRegStr HKLM "SOFTWARE\F2G Telco\ADB Automation" "ServiceInstalled" "1"
WriteRegStr HKLM "SOFTWARE\F2G Telco\ADB Automation" "ServiceName" "${SERVICE_NAME}"
WriteRegStr HKLM "SOFTWARE\F2G Telco\ADB Automation" "InstallPath" "$INSTDIR"

; Uninstaller registry cleanup
DeleteRegKey HKLM "SOFTWARE\F2G Telco\ADB Automation"