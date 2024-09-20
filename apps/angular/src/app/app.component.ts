import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	providers: [StrivacityAuthService],
	imports: [RouterOutlet, RouterLink, RouterLinkActive],
})
export class AppComponent {
	loading = true;
	isAuthenticated = false;
	name = '';

	constructor(protected strivacityAuthService: StrivacityAuthService) {
		this.strivacityAuthService.session$.subscribe((session) => {
			this.loading = session.loading;
			this.isAuthenticated = session.isAuthenticated;
			this.name = `${session.idTokenClaims?.given_name} ${session.idTokenClaims?.family_name}`;
		});
	}
}
