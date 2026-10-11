@echo off
if exist "%ProgramFiles%\Microsoft Office\root\Office16\OUTLOOK.EXE" (
  start "" "%ProgramFiles%\Microsoft Office\root\Office16\OUTLOOK.EXE"
) else if exist "%ProgramFiles(x86)%\Microsoft Office\root\Office16\OUTLOOK.EXE" (
  start "" "%ProgramFiles(x86)%\Microsoft Office\root\Office16\OUTLOOK.EXE"
) else (
  echo Klasik Outlook bulunamadi. Office kurulumunuzu kontrol edin.
  pause
)
