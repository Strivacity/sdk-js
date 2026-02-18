/// <reference types="vite/client" />

/* eslint-disable no-var */
import type { EmbeddedFlow } from './flows/EmbeddedFlow';

declare global {
	interface StrivacityFramework {
		/**
		 * The OIDC service instance managing authentication and tokens.
		 */
		oidcService?: EmbeddedFlow;
	}

	namespace globalThis {
		/**
		 * Application configuration object.
		 */
		var sty: StrivacityFramework;
	}
}
