FROM node:slim

ARG GIT_COMMIT=unspecified
ENV GIT_COMMIT=$GIT_COMMIT

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/data

CMD ["node", "src/seeders/seed_all.js"]
