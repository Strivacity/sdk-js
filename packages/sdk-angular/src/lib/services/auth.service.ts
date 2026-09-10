import type { IdTokenClaims, SDKInstance } from '../../types';
import { DestroyRef, Injectable, PLATFORM_ID, TransferState, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initFlow } from '@strivacity/sdk-core';
import { STRIVACITY_SDK } from '../utils';
import { SESSION_TRANSFER_KEY } from '../../server/session';

/**
 * Signal-based service exposing the Strivacity SDK state and actions to Angular components.
 *
 * Provided via `provideStrivacity()` (standalone) or `StrivacityAuthModule.forRoot()` (NgModule).
 */
@Injectable()
export class StrivacityAuthService {
	private readonly loadingSignal = signal(true);
	private readonly languageSignal = signal(globalThis.navigator?.language ?? 'en-US');
	private readonly isAuthenticatedSignal = signal(false);
	private readonly idTokenClaimsSignal = signal<IdTokenClaims | null>(null);
	private readonly accessTokenSignal = signal<string | null>(null);
	private readonly refreshTokenSignal = signal<string | null>(null);
	private readonly accessTokenExpiredSignal = signal(true);
	private readonly accessTokenExpirationDateSignal = signal<number | null>(null);

	readonly options = inject(STRIVACITY_SDK);
	readonly sdk: SDKInstance = initFlow(this.options as never);
	readonly loading = this.loadingSignal.asReadonly();
	readonly language = this.languageSignal.asReadonly();
	readonly isAuthenticated = this.isAuthenticatedSignal.asReadonly();
	readonly idTokenClaims = this.idTokenClaimsSignal.asReadonly();
	readonly accessToken = this.accessTokenSignal.asReadonly();
	readonly refreshToken = this.refreshTokenSignal.asReadonly();
	readonly accessTokenExpired = this.accessTokenExpiredSignal.asReadonly();
	readonly accessTokenExpirationDate = this.accessTokenExpirationDateSignal.asReadonly();

	constructor() {
		if (this.options.serverSessionUri) {
			const transferState = inject(TransferState);
			const hydratedSession = transferState.get(SESSION_TRANSFER_KEY, undefined);

			if (hydratedSession) {
				this.sdk.session = hydratedSession;

				if (isPlatformBrowser(inject(PLATFORM_ID))) {
					transferState.remove(SESSION_TRANSFER_KEY);
				}
			}
		}

		void this.updateSession();

		const subscription = this.sdk.subscribeToAllEvents(() => this.updateSession());
		inject(DestroyRef).onDestroy(() => subscription.dispose());
	}

	init(...args: Parameters<typeof this.sdk.init>): ReturnType<typeof this.sdk.init> {
		return this.sdk.init(...args);
	}

	subscribeToEvent(...args: Parameters<typeof this.sdk.subscribeToEvent>): ReturnType<typeof this.sdk.subscribeToEvent> {
		return this.sdk.subscribeToEvent(...args);
	}

	subscribeToAllEvents(...args: Parameters<typeof this.sdk.subscribeToAllEvents>): ReturnType<typeof this.sdk.subscribeToAllEvents> {
		return this.sdk.subscribeToAllEvents(...args);
	}

	checkAuthentication(...args: Parameters<typeof this.sdk.checkAuthentication>): ReturnType<typeof this.sdk.checkAuthentication> {
		return this.sdk.checkAuthentication(...args);
	}

	tokenExchange(...args: Parameters<typeof this.sdk.tokenExchange>): ReturnType<typeof this.sdk.tokenExchange> {
		return this.sdk.tokenExchange(...args);
	}

	handleCallback(...args: Parameters<typeof this.sdk.handleCallback>): ReturnType<typeof this.sdk.handleCallback> {
		return this.sdk.handleCallback(...args);
	}

	refresh(): ReturnType<typeof this.sdk.refresh> {
		return this.sdk.refresh();
	}

	revoke(): ReturnType<typeof this.sdk.revoke> {
		return this.sdk.revoke();
	}

	logout(...args: Parameters<typeof this.sdk.logout>): ReturnType<typeof this.sdk.logout> {
		return this.sdk.logout(...args);
	}

	login(...args: Parameters<typeof this.sdk.login>): ReturnType<typeof this.sdk.login> {
		return this.sdk.login(...args);
	}

	register(...args: Parameters<typeof this.sdk.register>): ReturnType<typeof this.sdk.register> {
		return this.sdk.register(...args);
	}

	entry(...args: Parameters<typeof this.sdk.entry>): ReturnType<typeof this.sdk.entry> {
		return this.sdk.entry(...args);
	}

	private async updateSession(): Promise<void> {
		const authenticated = await this.sdk.isAuthenticated;

		if (this.loadingSignal()) {
			this.loadingSignal.set(false);
		}
		if (this.sdk.language !== this.languageSignal()) {
			this.languageSignal.set(this.sdk.language);
		}
		if (authenticated !== this.isAuthenticatedSignal()) {
			this.isAuthenticatedSignal.set(authenticated);
		}
		if (this.sdk.idTokenClaims !== this.idTokenClaimsSignal()) {
			this.idTokenClaimsSignal.set(this.sdk.idTokenClaims ?? null);
		}
		if (this.sdk.accessToken !== this.accessTokenSignal()) {
			this.accessTokenSignal.set(this.sdk.accessToken ?? null);
		}
		if (this.sdk.refreshToken !== this.refreshTokenSignal()) {
			this.refreshTokenSignal.set(this.sdk.refreshToken ?? null);
		}
		if (this.sdk.accessTokenExpired !== this.accessTokenExpiredSignal()) {
			this.accessTokenExpiredSignal.set(this.sdk.accessTokenExpired);
		}
		if (this.sdk.accessTokenExpirationDate !== this.accessTokenExpirationDateSignal()) {
			this.accessTokenExpirationDateSignal.set(this.sdk.accessTokenExpirationDate ?? null);
		}
	}
}
