@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODE="
where node >nul 2>nul
if %errorlevel%==0 set "NODE=node"
if not defined NODE if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" set "NODE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE (
  echo.
  echo 没有找到 Node.js。请先安装 Node.js 18 或更高版本，然后再双击这个文件。
  echo 下载地址：https://nodejs.org/
  echo.
  pause
  exit /b 1
)
echo.
echo 正在启动国博讲解手册...
start "" cmd /c "timeout /t 1 >nul & start http://127.0.0.1:4173"
"%NODE%" server.mjs
pause
