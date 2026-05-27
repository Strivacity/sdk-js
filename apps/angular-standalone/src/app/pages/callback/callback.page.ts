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
	error: string | null = null;
	errorDescription: string | null = null;

	constructor(
		protected route: ActivatedRoute,
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService<RedirectFlow>,
	) {}

	ngOnInit(): void {
		const url = new URL(location.href);

		if (url.searchParams.has('session_id')) {
			void this.router.navigate(['/login'], { queryParams: url.searchParams });
			return;
		}

		this.subscription.add(
			this.strivacityAuthService.handleCallback().subscribe({
				next: () => {
					void this.router.navigateByUrl('/profile');
				},
				error: (err) => {
					this.error = this.route.snapshot.queryParamMap.get('error');
					this.errorDescription = this.route.snapshot.queryParamMap.get('error_description');
					// eslint-disable-next-line no-console
					console.error('Error during callback handling:', err);
				},
			}),
		);
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
