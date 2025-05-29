import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-revoke')
export class RevokePage extends LitElement {
	connectedCallback() {
		super.connectedCallback();

		void this.init();
	}

	async init() {
		try {
			await globalThis.sdk.revoke();
		} catch {
		} finally {
			location.href = '/';
		}
	}

	render() {
		return html`
			<h1>Logging out...</h1>
		`;
	}
}
