import type { LoginFlowState } from '@strivacity/sdk-vue';
import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-register')
export class RegisterPage extends LitElement {
	static styles = css`
		:host {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		}

		sty-language-selector {
			margin-block-start: 1rem;
		}
	`;

	connectedCallback(): void {
		super.connectedCallback();

		if (globalThis.sdk.options.mode === 'redirect' || globalThis.sdk.options.mode === 'popup') {
			void globalThis.sdk.register({
				loginHint: import.meta.env?.VITE_LOGIN_HINT,
				acrValues: import.meta.env?.VITE_ACR_VALUES?.split(' '),
				uiLocales: import.meta.env?.VITE_UI_LOCALES?.split(' '),
				audiences: import.meta.env?.VITE_AUDIENCES?.split(' '),
			});
		}
	}

	async onLogin() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await document.querySelector<any>('app-main')?.router.goto('/profile');
	}

	onClose() {
		location.reload();
	}

	onError(event: CustomEvent) {
		alert(event.detail);
	}

	onBlockReady(_events: { previousState: LoginFlowState; state: LoginFlowState }) {
		// You can handle block ready events here
	}

	render() {
		if (globalThis.sdk.options.mode === 'redirect' || globalThis.sdk.options.mode === 'popup') {
			return html`
				<h1>Redirecting...</h1>
			`;
		} else if (globalThis.sdk.options.mode === 'embedded') {
			return html`
				<sty-notifications></sty-notifications>
				<sty-login @close="${this.onClose}" @login="${this.onLogin}" @error="${this.onError}" @block-ready="${this.onBlockReady}"></sty-login>
				<sty-language-selector></sty-language-selector>
			`;
		}
	}
}
