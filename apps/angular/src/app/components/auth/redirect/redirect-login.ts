import { Component, type OnInit, PLATFORM_ID, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { extraParams } from '../';

@Component({
	selector: 'app-redirect-login',
	template: `
		<section>
			<p>Loading...</p>
		</section>
	`,
})
export class RedirectLoginComponent implements OnInit {
	readonly authService = inject(StrivacityAuthService);
	readonly platformId = inject(PLATFORM_ID);

	readonly flowType = input.required<'login' | 'register'>();

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		if (this.flowType() === 'register') {
			void this.authService.register(extraParams);
		} else {
			void this.authService.login(extraParams);
		}
	}
}
