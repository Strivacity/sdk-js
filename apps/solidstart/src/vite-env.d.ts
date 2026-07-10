/// <reference types="vite/client" />
/// <reference types="filesystem-routing/types" />

export {};

declare module '@solidjs/web' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			'sty-app-configuration': ElementProps<LitElement>;
			'sty-app-token-field': ElementProps<LitElement>;
		}
	}
}
