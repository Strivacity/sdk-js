import type { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { RedirectCommand, Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

export const authGuard: CanActivateFn = async (_route, state) => {
	const authService = inject(StrivacityAuthService);
	const router = inject(Router);
	const { sdk } = authService;

	if (await sdk.isAuthenticated) {
		return true;
	}

	return new RedirectCommand(router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } }));
};
