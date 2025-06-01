FROM node:20-alpine

RUN apk update && apk add --no-cache libc6-compat

WORKDIR /app
COPY . .

RUN yarn --frozen-lockfile --production && yarn build
EXPOSE 8081

ENTRYPOINT ["node", "dist/main.js"]