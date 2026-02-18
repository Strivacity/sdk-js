import * as React from 'react';

declare global {
	namespace JSX {
		interface IntrinsicElements {
			'sty-notifications': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
			'sty-login': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
			'sty-language-selector': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
		}
	}
}
