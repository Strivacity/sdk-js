FROM node:24-alpine

RUN apk add --no-cache git python3 make g++ \
	&& corepack enable \
	&& corepack prepare pnpm@12 --activate

WORKDIR /app

COPY . .

RUN CI=true pnpm install --frozen-lockfile
RUN pnpm run build
RUN chmod +x docker-entrypoint.sh

EXPOSE 4200

ENTRYPOINT ["./docker-entrypoint.sh"]
