import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import analog from '@analogjs/platform';
import { createEvent } from 'h3';

/**
 * Bridges `src/server/middleware/auth.ts` into `vite serve` (dev mode).
 *
 * AnalogJS's dev server rewrites the request URL to `index.html` for the SSR/SPA fallback before its own
 * `server/middleware/**` discovery (`registerDevServerMiddleware`) runs, so that discovery never sees the real
 * `/auth/*` path in dev. `enforce: 'pre'` guarantees this plugin's middleware is registered - and therefore runs -
 * before that rewrite happens, so the real request URL is still intact here. Production Nitro doesn't have this
 * quirk, so `server/middleware/auth.ts` alone is sufficient once built.
 */
function strivacityAuthDevBridge(): Plugin {
	return {
		name: 'strivacity-auth-dev-bridge',
		enforce: 'pre',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith('/auth')) {
					next();
					return;
				}

				try {
					const handler = (await server.ssrLoadModule('/src/server/middleware/auth.ts')).default;
					// NOTE: h3's `fromNodeMiddleware` always resolves the handler's return value to `undefined`
					// (whether the request was handled/ended or just passed through via `next()`), so the return
					// value can't be used to detect whether a response was already sent - check the raw Node
					// response instead, otherwise `next()` gets called on an already-ended response, causing
					// "Cannot append headers after they are sent to the client".
					await handler(createEvent(req, res));

					if (!res.writableEnded) {
						next();
					}
				} catch (error) {
					next(error);
				}
			});
		},
	};
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	build: {
		target: ['es2020'],
	},
	resolve: {
		mainFields: ['module'],
	},
	plugins: [strivacityAuthDevBridge(), analog()],
	server: {
		port: 4200,
		host: 'localhost',
		fs: {
			allow: [resolve(__dirname, '../..')],
		},
	},
}));
