import { Component, type OnInit, PLATFORM_ID, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { extraParams } from '../';

@Component({
	selector: 'app-popup-login',
	template: `
		<section>
			<p>Loading...</p>
		</section>
	`,
})
export class PopupLoginComponent implements OnInit {
	readonly authService = inject(StrivacityAuthService);
	readonly platformId = inject(PLATFORM_ID);

	readonly flowType = input.required<'login' | 'register'>();

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		void this.init();
	}

	async init() {
		try {
			if (this.flowType() === 'register') {
				await this.authService.register(extraParams);
			} else {
				await this.authService.login(extraParams);
			}

			globalThis.location.href = '/profile';
		} catch (error) {
			globalThis.location.href = `/error?error_description=${encodeURIComponent(error.message)}`;
		}
	}
}
