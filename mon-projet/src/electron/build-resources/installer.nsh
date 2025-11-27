!macro customInstall
  StrCpy $0 "$LOCALAPPDATA\TelcoADB"
  StrCpy $1 "$INSTDIR\resources\backend\server\TelcoADBServer.exe"
  IfFileExists "$1" 0 done_init_db
    nsExec::ExecToLog 'cmd /c "set TELCOADB_RUNTIME_DIR=$0 && ""$1"" --init-db"'
  done_init_db:
!macroend
