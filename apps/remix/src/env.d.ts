/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

declare namespace JSX {
	interface IntrinsicElements {
		'sty-notifications': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
		'sty-login': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
		'sty-language-selector': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
	}
}
