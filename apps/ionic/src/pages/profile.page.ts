import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-profile')
export class ProfilePage extends LitElement {
	render() {
		return html`
			<dl>
				<dt><strong>accessToken</strong></dt>
				<dd>
					<pre>${JSON.stringify(globalThis.sdk.accessToken)}</pre>
				</dd>
				<dt><strong>refreshToken</strong></dt>
				<dd>
					<pre>${JSON.stringify(globalThis.sdk.refreshToken)}</pre>
				</dd>
				<dt><strong>accessTokenExpired</strong></dt>
				<dd>
					<pre>${JSON.stringify(globalThis.sdk.accessTokenExpired)}</pre>
				</dd>
				<dt><strong>accessTokenExpirationDate</strong></dt>
				<dd>
					<pre>
${globalThis.sdk.accessTokenExpirationDate ? new Date(globalThis.sdk.accessTokenExpirationDate * 1000).toLocaleString() : JSON.stringify(null)}</pre
					>
				</dd>
				<dt><strong>claims</strong></dt>
				<dd>
					<pre>${JSON.stringify(globalThis.sdk.idTokenClaims, null, 2)}</pre>
				</dd>
			</dl>
		`;
	}
}
