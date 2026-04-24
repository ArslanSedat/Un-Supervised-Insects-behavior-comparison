#!/bin/bash
echo "Démarrage du backend Flask..."
PYTHONUNBUFFERED=1 /app/venv/bin/python3 src/app.py &
BACKEND_PID=$!
echo "Démarrage du frontend Vite..."
npm run dev -- --host 0.0.0.0 --port 8080 &
FRONTEND_PID=$!
wait $BACKEND_PID $FRONTEND_PID