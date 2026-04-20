FROM node:20

WORKDIR /app

# Installer Python et pip
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

# Copier tout le projet
COPY . .

# Créer un venv frais dans le conteneur et installer les dépendances Python
RUN python3 -m venv /app/.venv && \
    . /app/.venv/bin/activate && \
    pip install Flask Flask-CORS scikit-learn

# Installer les dépendances Node.js
RUN npm install

EXPOSE 5000 8080

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]

