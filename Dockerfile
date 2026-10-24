FROM node:22-bookworm-slim
WORKDIR /app
COPY server.mjs profile-store.mjs tts-errors.mjs background-state.mjs ./
COPY public ./public
COPY scripts/install-profile.mjs ./scripts/install-profile.mjs
COPY assets/user-mask/profile.json assets/user-mask/user-mask-b358fbc4aeb1.glb assets/user-mask/LICENSE.txt ./assets/user-mask/
RUN node scripts/install-profile.mjs /app/assets/user-mask && chmod -R a+rX /app
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
