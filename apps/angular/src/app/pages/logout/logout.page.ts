import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-logout-page',
	templateUrl: './logout.page.html',
})
export class LogoutPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		// NOTE: in your own app, keep only the branch matching your `serverSideSession` setting.
		if (this.authService.sdk.options.serverSideSession) {
			if (isPlatformBrowser(this.platformId)) {
				globalThis.location.href = '/auth/logout';
			} else if (this.responseInit) {
				this.responseInit.status = 302;
				this.responseInit.headers = new Headers({ Location: '/auth/logout' });
			}
		} else if (isPlatformBrowser(this.platformId)) {
			void this.authService.logout();
		}
	}
}
