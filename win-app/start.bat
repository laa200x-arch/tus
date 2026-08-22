@echo off
rem 职场那些事 Windows 版启动脚本
rem 说明：若系统存在 ELECTRON_RUN_AS_NODE 环境变量会导致 Electron 无法启动，此处强制清除
setlocal
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
start "" "node_modules\electron\dist\electron.exe" "%~dp0"
