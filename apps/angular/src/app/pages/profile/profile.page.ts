import '@strivacity/common/components/token-field';
import type { SessionData } from '@strivacity/sdk-angular';
import { Component, CUSTOM_ELEMENTS_SCHEMA, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-profile-page',
	templateUrl: './profile.page.html',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProfilePage {
	readonly authService = inject(StrivacityAuthService);
	readonly router = inject(Router);

	// This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSessionUri` setting.
	readonly serverManaged = !!this.authService.options.serverSessionUri;

	// NOTE: Demo only: with server-managed sessions the SDK keeps the ID and refresh tokens out of the page, so this demo reads
	// the full session from its own demo-only route (src/server/server.ts `/api/session`) to display them.
	readonly serverSession = signal<SessionData | null>(null);

	// id_token is not a standalone signal — track via idTokenClaims() which updates together
	readonly idToken = computed(() => {
		if (this.serverManaged) {
			return this.serverSession()?.id_token ?? null;
		}

		this.authService.idTokenClaims();
		return this.authService.sdk.session?.id_token ?? null;
	});

	readonly accessToken = this.authService.accessToken;
	readonly expiresAt = this.authService.accessTokenExpirationDate;
	readonly refreshToken = computed(() => (this.serverManaged ? (this.serverSession()?.refresh_token ?? null) : this.authService.refreshToken()));

	constructor() {
		if (this.serverManaged && isPlatformBrowser(inject(PLATFORM_ID))) {
			void fetch('/api/session', { credentials: 'include' })
				.then(async (response) => (response.ok ? ((await response.json()) as SessionData | null) : null))
				.then((session) => this.serverSession.set(session))
				.catch(() => this.serverSession.set(null));
		}
	}

	async handleRefresh(): Promise<void> {
		// Server-managed sessions: refresh() navigates to the server's refresh route (`${authUriPrefix}/refresh`), which comes back to /profile
		try {
			await this.authService.refresh({ returnTo: '/profile' });
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
