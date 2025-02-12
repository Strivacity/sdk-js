import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-login-page',
	templateUrl: './login.page.html',
})
export class LoginPage {
	readonly subscription = new Subscription();

	constructor(
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService,
	) {}

	ngOnInit(): void {
		this.strivacityAuthService.login().subscribe({
			next: () => {
				void this.router.navigateByUrl('/profile');
			},
		});
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
