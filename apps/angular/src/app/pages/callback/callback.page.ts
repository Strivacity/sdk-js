import { Component, SkipSelf } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { type RedirectFlow, StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-callback-page',
	templateUrl: './callback.page.html',
})
export class CallbackPage {
	readonly subscription = new Subscription();
	readonly query = Object.fromEntries(new URLSearchParams(globalThis.window.location.search));

	constructor(
		protected route: ActivatedRoute,
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService<RedirectFlow>,
	) {}

	ngOnInit(): void {
		this.subscription.add(
			this.strivacityAuthService.handleCallback().subscribe({
				next: () => {
					this.router.navigateByUrl('/profile');
				},
			}),
		);
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
