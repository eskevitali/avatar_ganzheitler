FROM node:22-bookworm-slim
WORKDIR /app
COPY server.mjs profile-store.mjs tts-errors.mjs ./
COPY public ./public
RUN chmod -R a+rX /app
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
