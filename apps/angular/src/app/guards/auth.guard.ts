import type { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { RedirectCommand, Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

export const authGuard: CanActivateFn = async () => {
	const authService = inject(StrivacityAuthService);
	const router = inject(Router);

	await authService.init();

	if (await authService.sdk.isAuthenticated) {
		return true;
	}

	return new RedirectCommand(router.parseUrl('/login'));
};
