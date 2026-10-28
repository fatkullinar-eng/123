; Native NSIS installer. WriteUninstaller embeds the uninstaller at compile time:
; no Wine or Windows executable is run during Linux packaging.
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

Name "Bar Estimate"
Unicode true
OutFile "${PROJECT_DIR}/release/Bar-Estimate-${VERSION}-Setup.exe"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1049 "ProductName" "Bar Estimate"
VIAddVersionKey /LANG=1049 "FileDescription" "Bar Estimate Setup"
VIAddVersionKey /LANG=1049 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1049 "LegalCopyright" "Bar Estimate"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Bar Estimate"
InstallDirRegKey HKCU "Software\BarEstimate" "InstallDir"
SetCompressor /SOLID zlib
ShowInstDetails show
ShowUninstDetails show
BrandingText "Bar Estimate — локальный калькулятор"

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Bar Estimate.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Запустить Bar Estimate"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Russian"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Приложение требует 64-разрядную Windows 10 или 11."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "Приложение требует Windows 10 или 11."
    Abort
  ${EndIf}
  SetShellVarContext current
FunctionEnd

Function .onVerifyInstDir
  ; Avoid placing files over an unrelated non-empty directory.
  ${If} ${FileExists} "$INSTDIR\*.*"
  ${AndIfNot} ${FileExists} "$INSTDIR\.bar-estimate-install"
    Abort
  ${EndIf}
FunctionEnd

Section "Bar Estimate" SEC_APP
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${PROJECT_DIR}/release/win-unpacked/*"
  FileOpen $0 "$INSTDIR\.bar-estimate-install" w
  FileWrite $0 "Bar Estimate ${VERSION}"
  FileClose $0
  WriteUninstaller "$INSTDIR\Uninstall Bar Estimate.exe"
  CreateDirectory "$SMPROGRAMS\Bar Estimate"
  CreateShortcut "$SMPROGRAMS\Bar Estimate\Bar Estimate.lnk" "$INSTDIR\Bar Estimate.exe"
  CreateShortcut "$DESKTOP\Bar Estimate.lnk" "$INSTDIR\Bar Estimate.exe"
  WriteRegStr HKCU "Software\BarEstimate" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BarEstimate" "DisplayName" "Bar Estimate"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BarEstimate" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BarEstimate" "Publisher" "Bar Estimate"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BarEstimate" "DisplayIcon" "$INSTDIR\Bar Estimate.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BarEstimate" "UninstallString" '$\"$INSTDIR\Uninstall Bar Estimate.exe$\"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BarEstimate" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BarEstimate" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  ; Check the running application before touching any other file.
  ${If} ${FileExists} "$INSTDIR\Bar Estimate.exe"
    ClearErrors
    Delete "$INSTDIR\Bar Estimate.exe"
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONEXCLAMATION "Закройте Bar Estimate и запустите удаление ещё раз."
      Abort
    ${EndIf}
  ${EndIf}
  !include "${PROJECT_DIR}/build/uninstall-files.nsh"
  Delete "$SMPROGRAMS\Bar Estimate\Bar Estimate.lnk"
  RMDir "$SMPROGRAMS\Bar Estimate"
  Delete "$DESKTOP\Bar Estimate.lnk"
  DeleteRegKey HKCU "Software\BarEstimate"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BarEstimate"
  Delete "$INSTDIR\.bar-estimate-install"
  Delete "$INSTDIR\Uninstall Bar Estimate.exe"
  RMDir "$INSTDIR"
  ; The user's profile and local estimates are intentionally retained.
SectionEnd
