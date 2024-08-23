import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { type RedirectFlow, StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-register-page',
	templateUrl: './register.page.html',
})
export class RegisterPage {
	readonly subscription = new Subscription();

	constructor(
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService<RedirectFlow>,
	) {}

	ngOnInit(): void {
		this.strivacityAuthService.register().subscribe({
			next: () => {
				this.router.navigateByUrl('/profile');
			},
		});
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
