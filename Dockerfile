FROM node:20-slim
WORKDIR /app
COPY server.js .
COPY public ./public
EXPOSE 5000
CMD ["node", "server.js"]
