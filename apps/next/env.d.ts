/// <reference types="vite/client" />

export {};

declare global {
	// eslint-disable-next-line no-var
	var sty: {
		authConfig: Record<string, unknown>;
	};
}

declare module 'react' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			'sty-app-configuration': ElementProps<LitElement>;
			'sty-app-token-field': ElementProps<LitElement>;
		}
	}
}
