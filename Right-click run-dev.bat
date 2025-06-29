@echo off
cd /d "D:\order-blitz-board/backend"
start cmd /k "npm run dev"
cd /d "D:\order-blitz-board/order-blitz-board"
start cmd /k "npm run dev"
