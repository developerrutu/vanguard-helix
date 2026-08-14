FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared ./shared
COPY client ./client
COPY server ./server
COPY scripts ./scripts
RUN npm ci && npm run build
ENV HOST=0.0.0.0
ENV HELIX_ENV=prod
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "server/dist/index.mjs"]
