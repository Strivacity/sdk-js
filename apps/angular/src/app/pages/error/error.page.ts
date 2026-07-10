import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
	selector: 'app-error-page',
	templateUrl: './error.page.html',
})
export class ErrorPage {
	private readonly route = inject(ActivatedRoute);

	protected readonly message =
		this.route.snapshot.queryParamMap.get('error_description') ??
		this.route.snapshot.queryParamMap.get('error') ??
		this.route.snapshot.queryParamMap.get('message');
}
