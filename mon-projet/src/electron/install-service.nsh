; Custom NSIS script for service installation
!include "MUI2.nsh"
!include "ServiceLib.nsh"

; Service configuration
!define SERVICE_NAME "TelcoADBService"
!define SERVICE_DISPLAY_NAME "Telco ADB Automation Service"
!define SERVICE_DESCRIPTION "Service backend pour l'automatisation télécoms ADB"
!define SERVICE_EXE "$INSTDIR\resources\backend\server\TelcoADBServer.exe"

; Install service function
Function InstallService
  ; Install the service
  ${If} ${ServiceExists} "${SERVICE_NAME}"
    DetailPrint "Service ${SERVICE_NAME} already exists, stopping..."
    ${ServiceStop} "${SERVICE_NAME}"
    ${ServiceDelete} "${SERVICE_NAME}"
  ${EndIf}
  
  DetailPrint "Installing service ${SERVICE_NAME}..."
  ${ServiceInstall} "${SERVICE_NAME}" "${SERVICE_DISPLAY_NAME}" "16" "2" "${SERVICE_EXE}" "" "" ""
  ${ServiceSetDescription} "${SERVICE_NAME}" "${SERVICE_DESCRIPTION}"
  
  ; Start the service
  DetailPrint "Starting service ${SERVICE_NAME}..."
  ${ServiceStart} "${SERVICE_NAME}"
FunctionEnd

; Uninstall service function  
Function un.UninstallService
  DetailPrint "Stopping service ${SERVICE_NAME}..."
  ${un.ServiceStop} "${SERVICE_NAME}"
  
  DetailPrint "Removing service ${SERVICE_NAME}..."
  ${un.ServiceDelete} "${SERVICE_NAME}"
FunctionEnd