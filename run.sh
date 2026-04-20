#!/bin/bash

IMAGE_NAME="bourdons-ui"
CONTAINER_NAME="bourdons-container"

#echo "Build de l'image Docker..."

docker build -t "$IMAGE_NAME" .

#echo "Lancement du conteneur..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker run -d --name "$CONTAINER_NAME" -p 8080:8080 -p 5000:5000 "$IMAGE_NAME"

echo "L'interface est accessible sur http://localhost:8080"
#echo "Le backend est accessible sur http://localhost:5000"
