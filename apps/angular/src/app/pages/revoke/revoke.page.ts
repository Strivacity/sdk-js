import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-revoke-page',
	templateUrl: './revoke.page.html',
})
export class RevokePage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		// NOTE: in your own app, keep only the branch matching your `serverSideSession` setting.
		if (this.authService.sdk.options.serverSideSession) {
			if (isPlatformBrowser(this.platformId)) {
				globalThis.location.href = '/auth/revoke';
			} else if (this.responseInit) {
				this.responseInit.status = 302;
				this.responseInit.headers = new Headers({ Location: '/auth/revoke' });
			}
		} else if (isPlatformBrowser(this.platformId)) {
			void this.handleRevoke();
		}
	}

	private async handleRevoke(): Promise<void> {
		try {
			await this.authService.revoke();
			await this.router.navigateByUrl('/');
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
