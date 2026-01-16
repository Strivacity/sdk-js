import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-register')
export class RegisterPage extends LitElement {
	connectedCallback(): void {
		super.connectedCallback();

		void globalThis.sdk.register({
			audiences: import.meta.env?.VITE_AUDIENCES?.split(' '),
		});
	}

	render() {
		return html`
			<h1>Redirecting...</h1>
		`;
	}
}
