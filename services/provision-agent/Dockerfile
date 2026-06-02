FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY index.js ./

# Instalar docker CLI para executar comandos Docker do host
RUN apk add --no-cache docker-cli

CMD ["node", "index.js"]
