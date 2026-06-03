FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g serve
COPY out ./out
EXPOSE 3003
CMD ["serve", "-s", "out", "-l", "3003"]
