import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-callback-page',
	templateUrl: './callback.page.html',
})
export class CallbackPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		// NOTE: This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSideSession` setting.
		if (this.authService.sdk.options.serverSideSession) {
			const query = new URLSearchParams(this.route.snapshot.queryParams as Record<string, string>).toString();
			const url = `/auth/callback${query ? `?${query}` : ''}`;

			if (isPlatformBrowser(this.platformId)) {
				globalThis.location.href = url;
			} else if (this.responseInit) {
				this.responseInit.status = 302;
				this.responseInit.headers = new Headers({ Location: url });
			}
		} else if (isPlatformBrowser(this.platformId)) {
			void this.handleCallback();
		}
	}

	private async handleCallback(): Promise<void> {
		const params = this.route.snapshot.queryParams;

		if (params.error || params.error_description) {
			await this.router.navigate(['/error'], { queryParams: params });
			return;
		}

		try {
			await this.authService.handleCallback();
			await this.router.navigateByUrl('/profile');
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
