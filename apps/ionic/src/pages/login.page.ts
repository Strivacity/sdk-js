import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-login')
export class LoginPage extends LitElement {
	connectedCallback(): void {
		super.connectedCallback();

		void globalThis.sdk.login();
	}

	render() {
		return html`
			<h1>Redirecting...</h1>
		`;
	}
}
