#!/bin/bash
source /app/.venv/bin/activate
echo "Démarrage du backend Flask..."
PYTHONUNBUFFERED=1 python3 src/MLProcess.py &
BACKEND_PID=$!
echo "Démarrage du frontend Vite..."
npm run dev -- --host 0.0.0.0 --port 8080 &
FRONTEND_PID=$!
wait $BACKEND_PID $FRONTEND_PID
