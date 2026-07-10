import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-root',
	templateUrl: './app.html',
	imports: [RouterOutlet, RouterLink, RouterLinkActive],
})
export class App {
	readonly authService = inject(StrivacityAuthService);
	readonly name = computed(() => {
		const claims = this.authService.idTokenClaims();

		return `${claims?.given_name ?? ''} ${claims?.family_name ?? ''}`;
	});
}
