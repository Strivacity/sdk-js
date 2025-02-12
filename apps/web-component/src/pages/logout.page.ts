import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-logout')
export class LogoutPage extends LitElement {
	connectedCallback() {
		super.connectedCallback();

		void this.init();
	}

	async init() {
		if (await globalThis.sdk.isAuthenticated) {
			await globalThis.sdk.logout();
		} else {
			location.href = '/';
		}
	}

	render() {
		return html`
			<h1>Redirecting...</h1>
		`;
	}
}
