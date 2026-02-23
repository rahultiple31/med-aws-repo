FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY public ./public
COPY views ./views
COPY server.js ./server.js
COPY package.json ./package.json

EXPOSE 3000
CMD ["node", "server.js"]
