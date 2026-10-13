FROM node:24-alpine AS build

WORKDIR /usr/src/api
COPY package.json package-lock.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npm run build
RUN npm ci --omit=dev

FROM node:24-alpine
RUN apk add --update curl
WORKDIR /usr/src/api
COPY --from=build /usr/src/api/node_modules /usr/src/api/node_modules
COPY --from=build /usr/src/api/build /usr/src/api/build
EXPOSE 8081
HEALTHCHECK CMD curl --fail http://127.0.0.1:8081/ping || exit 1
CMD ["node", "./build/server.js"]