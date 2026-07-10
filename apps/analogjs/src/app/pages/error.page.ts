import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
	selector: 'app-error-page',
	template: `
		<section>
			<h2>Something went wrong</h2>
			@if (message) {
				<p class="profile-muted">{{ message }}</p>
			}
		</section>
	`,
})
export default class ErrorPage {
	private readonly route = inject(ActivatedRoute);

	protected readonly message =
		this.route.snapshot.queryParamMap.get('error_description') ??
		this.route.snapshot.queryParamMap.get('error') ??
		this.route.snapshot.queryParamMap.get('message');
}
