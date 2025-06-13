import { LitElement, css, html, nothing } from 'lit';
import { Router } from '@lit-labs/router';
import { customElement } from 'lit/decorators.js';
import { state } from 'lit/decorators/state.js';
import { initFlow, LocalStorage, SDKStorage } from '@strivacity/sdk-capacitor';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

class CapacitorStorage extends SDKStorage {
	async get(key: string): Promise<string | null> {
		const { value } = await Preferences.get({ key });
		return value;
	}

	async set(key: string, value: string): Promise<void> {
		await Preferences.set({ key, value });
	}

	async delete(key: string): Promise<void> {
		await Preferences.remove({ key });
	}
}

globalThis.sdk = initFlow({
	mode: 'redirect',
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: 'http://localhost:4200/callback',
	storageTokenName: 'sty.session.ionic',
	storage: Capacitor.getPlatform() === 'web' ? LocalStorage : CapacitorStorage,
});

@customElement('app-main')
export class AppComponent extends LitElement {
	static styles = css`
		*,
		*::before,
		*::after {
			box-sizing: border-box;
		}

		:host {
			display: block;
			font-family:
				system-ui,
				-apple-system,
				BlinkMacSystemFont,
				'Segoe UI',
				Roboto,
				Oxygen,
				Ubuntu,
				Cantarell,
				'Open Sans',
				'Helvetica Neue',
				sans-serif;
			max-width: 1200px;
			margin: 0 auto;
		}

		header {
			display: flex;
			align-items: center;
			padding: 1rem;
			margin-block-start: var(--ion-safe-area-top, 0);
			margin-block-end: var(--ion-safe-area-bottom, 0);
			border-block-end: 1px solid rgb(0 0 0 / 15%);

			> div {
				display: flex;
				align-items: center;
				gap: 1rem;

				+ div {
					margin-inline-start: auto;
				}
			}
		}

		section {
			padding: 1rem;
		}
	`;

	@state() name = '';
	@state() isAuthenticated = false;

	readonly router = new Router(this, [
		{
			path: '/callback',
			render: () => html`
				<page-callback></page-callback>
			`,
		},
		{
			path: '/',
			render: () => html`
				<page-index></page-index>
			`,
		},
		{
			path: '/login',
			render: () => html`
				<page-login></page-login>
			`,
		},
		{
			path: '/logout',
			render: () => html`
				<page-logout></page-logout>
			`,
		},
		{
			path: '/profile',
			enter: async () => {
				this.isAuthenticated = await globalThis.sdk.isAuthenticated;

				if (!this.isAuthenticated) {
					void this.router.goto('/login');
				}

				return this.isAuthenticated;
			},
			render: () => html`
				<page-profile></page-profile>
			`,
		},
		{
			path: '/register',
			render: () => html`
				<page-register></page-register>
			`,
		},
		{
			path: '/revoke',
			render: () => html`
				<page-revoke></page-revoke>
			`,
		},
	]);

	connectedCallback() {
		super.connectedCallback();

		void this.init();
	}

	async init() {
		this.isAuthenticated = await globalThis.sdk.isAuthenticated;

		if (this.isAuthenticated) {
			this.name = `${globalThis.sdk.idTokenClaims?.given_name} ${globalThis.sdk.idTokenClaims?.family_name}`;
		}
	}

	render() {
		return html`
			<header>
				<div>
					${this.isAuthenticated
						? html`
								<strong>Welcome, ${this.name}!</strong>
							`
						: nothing}
				</div>
				<div>
					<a href="/" data-button="home">Home</a>
					${this.isAuthenticated
						? html`
								<a href="/profile" data-button="profile">Profile</a>
								<a href="/revoke" data-button="revoke">Revoke</a>
								<a href="/logout" data-button="logout">Logout</a>
							`
						: html`
								<a href="/login" data-button="login">Login</a>
								<a href="/register" data-button="register">Register</a>
							`}
				</div>
			</header>
			<section>${this.router.outlet()}</section>
		`;
	}
}
