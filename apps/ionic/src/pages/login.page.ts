import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Capacitor } from '@capacitor/core';

@customElement('page-login')
export class LoginPage extends LitElement {
	connectedCallback(): void {
		super.connectedCallback();

		void this.init();
	}

	async init() {
		await globalThis.sdk.login();

		if (Capacitor.getPlatform() !== 'web') {
			location.href = '/profile';
		}
	}

	render() {
		return html`
			<h1>Redirecting...</h1>
		`;
	}
}
