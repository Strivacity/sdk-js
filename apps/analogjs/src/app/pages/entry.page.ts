import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-entry-page',
	template: `
		<section>
			<h1>Loading...</h1>
		</section>
	`,
})
export default class EntryPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);
	private readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			void this.handleEntry();
		}
	}

	private async handleEntry(): Promise<void> {
		if (!['embedded', 'native'].includes(this.authService.sdk.options.mode)) {
			await this.router.navigateByUrl('/login');
			return;
		}

		try {
			const params = (await this.authService.entry()) as Record<string, string>;
			const url = new URL(this.authService.sdk.options.loginUri, globalThis.location.origin);

			url.search = new URLSearchParams(params).toString();
			globalThis.location.href = url.toString();
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
