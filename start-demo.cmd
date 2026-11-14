@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo 未找到 node / python，请安装 Node.js（推荐）或 Python 3 后重试。
    pause
    exit /b 1
  )
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1"
if errorlevel 1 pause
