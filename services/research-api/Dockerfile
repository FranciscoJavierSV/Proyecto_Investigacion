FROM node:22-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm pkg delete dependencies.artillery \
	&& npm install --omit=dev --ignore-scripts

COPY server.js ./
COPY config ./config
COPY graphql ./graphql
COPY restapi ./restapi
COPY logs ./logs

EXPOSE 4000

CMD ["node", "server.js"]
