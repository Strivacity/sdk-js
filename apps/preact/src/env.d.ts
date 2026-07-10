/// <reference types="vite/client" />

export {};

declare module 'preact' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			'sty-app-configuration': ElementProps<LitElement>;
			'sty-app-token-field': ElementProps<LitElement>;
		}
	}
}
