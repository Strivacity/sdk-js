import { Component, inject, input } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { RedirectLoginComponent } from './redirect/redirect-login';
import { PopupLoginComponent } from './popup/popup-login';
import { EmbeddedLoginComponent } from './embedded/embedded-login';
import { NativeLoginComponent } from './native/native-login';

@Component({
	selector: 'app-auth-login',
	// This demo shows all supported modes side by side
	// In your own app, pick the single mode you use and drop the rest
	template: `
		@switch (mode) {
			@case ('redirect') {
				<app-redirect-login [flowType]="flowType()" />
			}
			@case ('popup') {
				<app-popup-login [flowType]="flowType()" />
			}
			@case ('embedded') {
				<app-embedded-login [flowType]="flowType()" />
			}
			@case ('native') {
				<app-native-login [flowType]="flowType()" />
			}
		}
	`,
	imports: [RedirectLoginComponent, PopupLoginComponent, EmbeddedLoginComponent, NativeLoginComponent],
})
export class AuthLoginComponent {
	readonly authService = inject(StrivacityAuthService);
	readonly flowType = input.required<'login' | 'register'>();
	readonly mode = this.authService.sdk.options.mode;
}
