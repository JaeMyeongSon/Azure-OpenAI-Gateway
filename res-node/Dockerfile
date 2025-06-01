FROM node:20-alpine

RUN apk update && apk add --no-cache libc6-compat

WORKDIR /app
COPY . .

RUN yarn --frozen-lockfile --production
RUN yarn build
EXPOSE 3000
CMD ["yarn", "start"]