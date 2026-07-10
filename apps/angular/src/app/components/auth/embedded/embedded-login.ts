import { Component, CUSTOM_ELEMENTS_SCHEMA, type OnInit, PLATFORM_ID, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { injectScript } from '@strivacity/sdk-angular';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { extraParams } from '../';

// "Embedded" mode doesn't use any SDK composable directly. Instead the Strivacity auth server
// ships a bundle of pre-built, framework-agnostic web components (custom elements) that render
// the whole login UI inside <sty-login>. This component just configures and mounts
// that element and reacts to the DOM events it dispatches.

@Component({
	selector: 'app-embedded-login',
	templateUrl: './embedded-login.html',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EmbeddedLoginComponent implements OnInit {
	readonly authService = inject(StrivacityAuthService);
	readonly router = inject(Router);
	readonly route = inject(ActivatedRoute);
	readonly platformId = inject(PLATFORM_ID);

	readonly flowType = input.required<'login' | 'register'>();

	get params() {
		return this.flowType() === 'register' ? { ...extraParams, prompt: 'create' } : extraParams;
	}

	// Resume a session started from an entry URL (e.g. a password-reset)
	readonly sessionId = this.route.snapshot.queryParamMap.get('session_id');
	readonly shortAppId = this.route.snapshot.queryParamMap.get('short_app_id');
	readonly language = this.route.snapshot.queryParamMap.get('language') ?? (isPlatformBrowser(this.platformId) ? globalThis.navigator.language : 'en-US');

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
		// custom element definitions from the auth server
		injectScript('sty-components', `${this.authService.sdk.options.issuer}/assets/components/bundle.js`);
	}

	onLogin(): void {
		// Fired by <sty-login> once the user completes the flow
		void this.router.navigateByUrl('/profile');
	}

	onClose(): void {
		// Fired when the user finishes the flow with a close action (e.g. close button)
		globalThis.location.reload();
	}

	onError(event: Event): void {
		// Fired when the flow can't continue (e.g. network/config problem)
		alert((event as CustomEvent<string>).detail);
	}
}
