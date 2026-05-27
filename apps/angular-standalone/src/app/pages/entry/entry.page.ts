import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-entry-page',
	templateUrl: './entry.page.html',
})
export class EntryPage {
	constructor(
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService,
	) {}

	ngOnInit() {
		this.strivacityAuthService.entry().subscribe({
			next: (data) => {
				if (data && Object.keys(data).length > 0) {
					void this.router.navigate([`/callback`], { queryParams: new URLSearchParams(data) });
				} else {
					void this.router.navigate(['/']);
				}
			},
			error: (error) => {
				alert(error);
				void this.router.navigate(['/']);
			},
		});
	}
}
