# à modifier avant envoi définitif

FROM node:20

WORKDIR /app

RUN apt-get update && apt-get install -y python3 python3-pip python3-venv python3-dev build-essential && rm -rf /var/lib/apt/lists/*

COPY . .

RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

RUN npm install

EXPOSE 5000 8080

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]