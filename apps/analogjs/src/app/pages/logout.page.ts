import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-logout-page',
	template: `
		<section>
			<h1>Logging out...</h1>
		</section>
	`,
})
export default class LogoutPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		// NOTE: in your own app, keep only the branch matching your `serverSideSession` setting.
		if (this.authService.sdk.options.serverSideSession) {
			if (isPlatformBrowser(this.platformId)) {
				globalThis.location.href = '/auth/logout';
			}
		} else if (isPlatformBrowser(this.platformId)) {
			void this.authService.logout();
		}
	}
}
