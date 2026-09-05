FROM node:22-slim

WORKDIR /app

COPY services/research-api/package*.json ./
RUN npm ci --omit=dev

COPY scripts ./scripts

CMD ["scripts/aggregate_metrics.js"]
