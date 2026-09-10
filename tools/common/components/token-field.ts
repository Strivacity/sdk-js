import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { decodeJwt } from '@strivacity/sdk-core/utils';

@customElement('sty-app-token-field')
export class TokenFieldComponent extends LitElement {
	readonly labels: Record<typeof this.type, string> = {
		id_token: 'ID token',
		access_token: 'Access token',
		refresh_token: 'Refresh token',
	};
	copyResetTimer: ReturnType<typeof setTimeout> | null = null;

	@property({ type: String }) declare type: 'id_token' | 'access_token' | 'refresh_token';
	@property({ attribute: false }) declare value: string | null | undefined;
	@property({ attribute: false }) declare expiresAt: number | null;

	@state() declare visible: boolean;
	@state() declare copied: boolean;

	constructor() {
		super();

		this.type = 'access_token';
		this.value = null;
		this.expiresAt = null;
		this.visible = false;
		this.copied = false;
	}

	override createRenderRoot() {
		return this;
	}

	override connectedCallback() {
		super.connectedCallback();
		this.classList.add('field-box');
	}

	override disconnectedCallback() {
		super.disconnectedCallback();

		if (this.copyResetTimer) {
			clearTimeout(this.copyResetTimer);
		}
	}

	get claims(): Record<string, unknown> | null {
		return this.type === 'refresh_token' ? null : this.decodeJwt(this.value);
	}

	get resolvedExpiresAt(): number | null {
		if (this.expiresAt) {
			return this.expiresAt;
		}

		const exp = this.claims?.exp;

		return typeof exp === 'number' ? exp : null;
	}

	decodeJwt(token?: string | null): Record<string, unknown> | null {
		if (!token) {
			return null;
		}

		try {
			return decodeJwt(token);
		} catch {
			return null;
		}
	}

	formatTimestamp(seconds: number): string {
		return new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
	}

	formatClaimValue(key: string, value: unknown): string {
		if (['exp', 'iat', 'nbf', 'auth_time'].includes(key) && typeof value === 'number') {
			return `${value} (${this.formatTimestamp(value)})`;
		}
		if (value === null || value === undefined) {
			return '-';
		}
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}

		return String(value);
	}

	toggleVisibility() {
		this.classList.toggle('is-visible');
	}

	async copy() {
		if (!this.value) {
			return;
		}

		try {
			await navigator.clipboard.writeText(this.value);
			this.copied = true;

			if (this.copyResetTimer) {
				clearTimeout(this.copyResetTimer);
			}

			this.copyResetTimer = setTimeout(() => {
				this.copied = false;
			}, 1500);
		} catch (error) {
			console.error('Failed to copy token', error);
		}
	}

	async openDialog() {
		await this.updateComplete;
		this.querySelector<HTMLDialogElement>('[data-role="claims-dialog"]')?.showModal();
	}

	override render() {
		const claims = this.claims;
		const expiresAt = this.resolvedExpiresAt;
		const label = this.labels[this.type];

		return html`
			<div class="field-box-header">
				<span class="field-box-header-label">${label}</span>
				<div class="field-box-header-actions">
					${
						this.type === 'refresh_token'
							? html`
									<button
										class="action"
										type="button"
										?disabled=${!this.value}
										@click=${() => this.dispatchEvent(new CustomEvent('refreshToken', { bubbles: true, composed: true }))}
									>
										Refresh
									</button>
								`
							: nothing
					}
					${
						claims
							? html`
									<button class="action" type="button" @click=${() => void this.openDialog()}>View claims</button>
								`
							: nothing
					}
					<button class="action" type="button" ?disabled=${!this.value} @click=${() => this.toggleVisibility()}>${this.visible ? 'Hide' : 'Show'}</button>
					<button class="action" type="button" ?disabled=${!this.value} @click=${() => this.copy()}>${this.copied ? 'Copied' : 'Copy'}</button>
				</div>
			</div>
			<div class="token-field-value">${this.value}</div>
			${
				expiresAt
					? html`
							<div class="field-box-meta">Expires: ${this.formatTimestamp(expiresAt)}</div>
						`
					: nothing
			}
			${
				claims
					? html`
							<dialog class="field-box-dialog" data-role="claims-dialog">
								<form method="dialog" class="field-box-dialog-header">
									<h3>${label} claims</h3>
									<button type="submit" class="field-box-dialog-close" aria-label="Close">&times;</button>
								</form>
								<dl class="field-box-list">
									${Object.entries(claims).map(
										([claimKey, claimValue]) => html`
											<dt>${claimKey}</dt>
											<dd>${this.formatClaimValue(claimKey, claimValue)}</dd>
										`,
									)}
								</dl>
							</dialog>
						`
					: nothing
			}
		`;
	}
}
