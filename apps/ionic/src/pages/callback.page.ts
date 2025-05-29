import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { state } from 'lit/decorators/state.js';
import { Capacitor } from '@capacitor/core';

@customElement('page-callback')
export class CallbackPage extends LitElement {
	@state() query = Object.fromEntries(new URLSearchParams(globalThis.window.location.search));

	connectedCallback() {
		super.connectedCallback();

		if (Capacitor.getPlatform() === 'web') {
			// For web, we handle the callback immediately
			void this.init();
		}
	}

	async init() {
		try {
			// @ts-expect-error: Fix this
			await globalThis.sdk.handleCallback();
			location.href = '/profile';
		} catch {}
	}

	render() {
		return this.query.error
			? html`
					<h1>Error in authentication</h1>
					<div>
						<h4>${this.query.error}</h4>
						<p>${this.query.error_description}</p>
					</div>
				`
			: html`
					<h1>Logging in...</h1>
				`;
	}
}
