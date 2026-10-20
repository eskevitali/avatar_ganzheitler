FROM node:22-bookworm-slim
WORKDIR /app
COPY server.mjs ./
COPY public ./public
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
