#!/bin/bash

docker rm -f bourdons-container 2>/dev/null || true

CONTAINER_NAME=bourdons-container

cleanup() {
  echo "Stopping and removing container ${CONTAINER_NAME}..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  }

trap cleanup INT TERM EXIT

docker run \
       --rm \
       --name ${CONTAINER_NAME} \
       -p 5000:5000 \
       -p 8080:8080 \
       bourdons-ui