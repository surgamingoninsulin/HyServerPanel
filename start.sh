#!/bin/bash

# Go into backend and start it in the background
cd ./backend
npm run dev &
BACKEND_PID=$!

# Go back and into frontend and start it in the background
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Save the ID numbers (PIDs) so we can stop them later
echo $BACKEND_PID > ../backend.pid
echo $FRONTEND_PID > ../frontend.pid

# Wait a few seconds then open the website
sleep 5
open "https://localhost:5173" || xdg-open "https://localhost:5173"