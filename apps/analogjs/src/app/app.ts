import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, RouterLink, RouterLinkActive],
	template: `
		<header>
			<div>
				@if (authService.isAuthenticated()) {
					<strong>Welcome, {{ name() }}!</strong>
				} @else if (authService.loading()) {
					<strong>Loading...</strong>
				}
			</div>
			<div>
				<a routerLink="/" routerLinkActive="active" data-button="home">Home</a>
				@if (authService.isAuthenticated()) {
					<a routerLink="/profile" routerLinkActive="active" data-button="profile">Profile</a>
					<a routerLink="/revoke" routerLinkActive="active" data-button="revoke">Revoke</a>
					<a routerLink="/logout" routerLinkActive="active" data-button="logout">Logout</a>
				} @else {
					<a routerLink="/login" routerLinkActive="active" data-button="login">Login</a>
					<a routerLink="/register" routerLinkActive="active" data-button="register">Register</a>
				}
			</div>
		</header>
		<router-outlet />
	`,
})
export class App {
	protected readonly authService = inject(StrivacityAuthService);
	protected readonly name = computed(() => {
		const claims = this.authService.idTokenClaims();

		return `${claims?.given_name ?? ''} ${claims?.family_name ?? ''}`;
	});
}
