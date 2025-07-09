import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-logout-page',
	templateUrl: './logout.page.html',
})
export class LogoutPage {
	readonly subscription = new Subscription();

	constructor(
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService,
	) {}

	async ngOnInit(): Promise<void> {
		if (this.strivacityAuthService.isAuthenticated()) {
			await firstValueFrom(this.strivacityAuthService.logout({ postLogoutRedirectUri: window.location.origin }));
		} else {
			void this.router.navigateByUrl('/');
		}
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
