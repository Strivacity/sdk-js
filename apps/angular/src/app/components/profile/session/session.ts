import { Component, inject } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-session',
	templateUrl: './session.html',
	imports: [DatePipe, JsonPipe],
})
export class SessionComponent {
	protected readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);

	protected async handleRefresh(): Promise<void> {
		// NOTE: This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSideSession` setting.
		if (this.authService.options.serverSideSession) {
			globalThis.location.href = '/auth/refresh?returnTo=/profile';
		} else {
			try {
				await this.authService.refresh();
			} catch (error) {
				await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
			}
		}
	}
}
