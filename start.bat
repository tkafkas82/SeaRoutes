@echo off
cd /d "%~dp0"
start "" http://localhost:4900
node server.js
