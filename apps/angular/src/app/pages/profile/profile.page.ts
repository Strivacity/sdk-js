import '@strivacity/common/components/token-field';
import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
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

	// id_token is not a standalone signal — track via idTokenClaims() which updates together
	readonly idToken = computed(() => {
		this.authService.idTokenClaims();
		return this.authService.sdk.session?.id_token ?? null;
	});

	readonly accessToken = this.authService.accessToken;
	readonly expiresAt = this.authService.accessTokenExpirationDate;
	readonly refreshToken = this.authService.refreshToken;

	async handleRefresh(): Promise<void> {
		// This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSessionUri` setting.
		if (this.authService.options.serverSessionUri) {
			globalThis.location.href = '/auth/refresh?returnTo=/profile';
		} else {
			try {
				await this.authService.refresh();
			} catch (error) {
				await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
			}
		}
	}
}
