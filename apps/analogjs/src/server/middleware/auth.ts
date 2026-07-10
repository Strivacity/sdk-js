import { defineEventHandler, fromNodeMiddleware } from 'h3';
import express from 'express';
import { sdkOptions, getServerSdk } from '../strivacity';

// NOTE: AnalogJS's dev server (`vite serve`) only auto-wires `server/middleware/**` files, not `server/routes/**`
// (the latter is only assembled by the production Nitro build) - so the Express auth router is bridged here
// instead, as middleware that runs on every request and only takes over for paths under `authUrlPrefix`.
// `createServerSDK().router` is an Express `Router`, mounted on a throwaway Express app (to get the prefix
// stripped the same way apps/angular's server.ts does via `app.use(authUrlPrefix, serverSdk.router)`) and
// adapted to an h3 event handler via `fromNodeMiddleware`.
const app = express();
const serverSdk = getServerSdk();

if (serverSdk) {
	app.use(sdkOptions.authUrlPrefix!, serverSdk.router);
}

const handler = serverSdk ? fromNodeMiddleware(app) : undefined;

export default defineEventHandler((event) => {
	const { pathname } = new URL(event.node.req.url ?? '/', 'http://localhost');
	const prefix = sdkOptions.authUrlPrefix!;

	if (!handler || (pathname !== prefix && !pathname.startsWith(`${prefix}/`))) {
		return;
	}

	return handler(event);
});
