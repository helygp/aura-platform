FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.js docs.html mcp-landing.html ./
CMD ["node", "index.js"]
