import type { NativeParams } from '@strivacity/sdk-core';
import type { CustomSession } from './types';
import { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
import { Session } from '@strivacity/sdk-core/utils/Session';
import { CustomNativeFlowHandler } from './CustomNativeFlowHandler';

export class CustomNativeFlow extends NativeFlow {
	declare session: CustomSession | null;

	override get accessTokenExpired(): boolean {
		return !this.session || !!this.session?.accessTokenExpired;
	}

	async fetchSessionData(): Promise<void> {
		const response = await this.httpClient.request<CustomSession>(new URL('/api/session/info', location.origin).toString(), {
			method: 'GET',
			credentials: 'include',
		});

		this.session = new Session() as CustomSession;
		Object.assign(this.session, await response.json());

		if (!this.accessTokenExpired) {
			this.dispatchEvent('loggedIn', [{ claims: this.idTokenClaims! }]);
		}
	}

	override login(params: NativeParams = {}): CustomNativeFlowHandler {
		this.dispatchEvent('loginInitiated', []);

		return new CustomNativeFlowHandler(this, params);
	}

	override register(params: NativeParams = {}): CustomNativeFlowHandler {
		params.prompt = 'create';

		return this.login(params);
	}

	override async refresh(): Promise<void> {
		this.logging?.debug('Attempting to refresh session');

		try {
			const response = await this.httpClient.request<CustomSession>(new URL('/api/session/refresh', location.origin).toString(), {
				method: 'POST',
				credentials: 'include',
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(`${data.error}: ${data.error_description}`);
			}

			this.session = new Session() as CustomSession;
			Object.assign(this.session, await response.json());

			if (!this.accessTokenExpired) {
				this.dispatchEvent('tokenRefreshed', [{ claims: this.idTokenClaims! }]);
				this.logging?.info('Session refreshed successfully');
			}
		} catch (error) {
			this.session = null;
			await this.storage.delete(this.options.storageTokenName!);

			this.dispatchEvent('tokenRefreshFailed', [{}]);
			this.logging?.info(`Session refresh failed - ${error as Error}`);
		}
	}

	override async revoke(): Promise<void> {
		try {
			const response = await this.httpClient.request<Record<string, string>>(new URL('/api/session/revoke', location.origin).toString(), {
				method: 'POST',
				credentials: 'include',
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(`${data.error}: ${data.error_description}`);
			}

			this.dispatchEvent('tokenRevoked', []);
		} catch (error) {
			this.dispatchEvent('tokenRevokeFailed', []);
			this.logging?.info(`Token revocation failed - ${error as Error}`);
		} finally {
			this.session = null;
			await this.storage.delete(this.options.storageTokenName!);

			this.logging?.info('Token successfully revoked');
		}
	}

	override async logout(): Promise<void> {
		if (typeof this.options.urlHandler !== 'function') {
			const error = new Error('Missing option: urlHandler');
			this.logging?.error('Required option missing', error);
			throw error;
		}

		this.logging?.debug('Attempting to logout');
		this.dispatchEvent('logoutInitiated', []);
		this.logging?.debug('Logout initiated');

		await this.options.urlHandler(new URL('/api/session/logout', location.origin).toString());
	}

	override async entry(url?: string): Promise<Record<string, string>> {
		if (!url) {
			url = globalThis.window?.location.href;
		}

		const response = await this.httpClient.request<Record<string, string>>(new URL('/api/session/entry', location.origin).toString(), {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(Object.fromEntries(new URL(url).searchParams)),
		});

		if (!response.ok) {
			if (response.status === 400) {
				const data = await response.json();
				let message = 'Entry request failed with status 400';

				if (typeof data === 'object') {
					if (data.error) {
						message = `${data.error}: ${data.error_description}`;
					} else if (data.errorKey) {
						message = data.errorKey;
					}
				}

				const error = new Error(message);
				this.logging?.error('Entry request error', error);
				throw error;
			}

			const error = new Error(`Entry request failed with status ${response.status}`);
			this.logging?.error('Entry request error', error);
			throw error;
		}

		const { session_id } = await response.json();

		if (!session_id) {
			const error = new Error('Session ID not found in entry response');
			this.logging?.error('Entry response error', error);
			throw error;
		}

		return { session_id };
	}
}
