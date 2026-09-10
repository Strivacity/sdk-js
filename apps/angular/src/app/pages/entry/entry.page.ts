import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-entry-page',
	templateUrl: './entry.page.html',
})
export class EntryPage implements OnInit {
	readonly authService = inject(StrivacityAuthService);
	readonly router = inject(Router);
	readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			void this.handleEntry();
		}
	}

	async handleEntry(): Promise<void> {
		try {
			const params = (await this.authService.entry()) as Record<string, string>;
			const url = new URL('/login', globalThis.location.origin);
			url.search = new URLSearchParams(params).toString();
			globalThis.location.href = url.toString();
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
