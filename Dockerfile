FROM node:20-bookworm AS client-build
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gh && rm -rf /var/lib/apt/lists/*
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN npm install --omit=dev
COPY server/src ./src
COPY --from=client-build /app/client/dist ./public
EXPOSE 19000
CMD ["npm", "start"]
