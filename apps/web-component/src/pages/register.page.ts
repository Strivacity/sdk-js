import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-register')
export class RegisterPage extends LitElement {
	connectedCallback(): void {
		super.connectedCallback();

		void globalThis.sdk.register({
			prompt: 'create',
			loginHint: import.meta.env?.VITE_LOGIN_HINT,
			acrValues: import.meta.env?.VITE_ACR_VALUES?.split(' '),
			uiLocales: import.meta.env?.VITE_UI_LOCALES?.split(' '),
			audiences: import.meta.env?.VITE_AUDIENCES?.split(' '),
		});
	}

	render() {
		return html`
			<h1>Redirecting...</h1>
		`;
	}
}
