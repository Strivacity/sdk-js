import { Component, CUSTOM_ELEMENTS_SCHEMA, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { injectScript, StrivacityAuthService, StrivacityNativeLoginService } from '@strivacity/sdk-angular';
import { NativeLoginRendererComponent } from '../../components/login';

const extraParams: Record<string, string | Array<string> | undefined> = {
	loginSessionUri: '/auth/login/session',
	loginHint: import.meta.env?.VITE_LOGIN_HINT,
	acrValues: import.meta.env?.VITE_ACR_VALUES?.split(' '),
	uiLocales: import.meta.env?.VITE_UI_LOCALES?.split(' '),
	audiences: import.meta.env?.VITE_AUDIENCES?.split(' '),
};
const extraSearchParams: Array<[string, string]> = Object.entries(extraParams).flatMap(([key, value]) =>
	(Array.isArray(value) ? value : [value]).map((item) => [key, String(item)] as [string, string]),
);

@Component({
	selector: 'app-register-page',
	templateUrl: './register.page.html',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [NativeLoginRendererComponent],
	providers: [StrivacityNativeLoginService],
})
export class RegisterPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	protected readonly nativeLoginService = inject(StrivacityNativeLoginService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly platformId = inject(PLATFORM_ID);

	protected readonly mode = this.authService.sdk.options.mode;
	protected readonly issuer = this.authService.sdk.options.issuer;
	protected readonly params = { ...extraParams, prompt: 'create' };
	protected readonly sessionId = this.route.snapshot.queryParamMap.get('session_id');
	protected readonly shortAppId = this.route.snapshot.queryParamMap.get('short_app_id');
	protected readonly language =
		this.route.snapshot.queryParamMap.get('language') ?? (isPlatformBrowser(this.platformId) ? globalThis.navigator.language : 'en-US');

	// NOTE: This demo shows all supported modes side by side
	// in your own app, pick the single mode you use and drop the rest
	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		if (this.mode === 'embedded') {
			injectScript('sty-components', `${this.issuer}/assets/components/bundle.js`);
		} else if (this.mode === 'redirect') {
			// NOTE: in your own app, keep only the branch matching your `serverSideSession` setting.
			if (this.authService.sdk.options.serverSideSession) {
				globalThis.location.href = `auth/register?${new URLSearchParams(extraSearchParams).toString()}`;
			} else {
				void this.authService.register(extraParams);
			}
		} else if (this.mode === 'popup') {
			try {
				this.authService.register(extraParams);
			} catch (error) {
				this.router.navigate(['/error'], { queryParams: { error_description: error instanceof Error ? error.message : 'Unknown error' } });
			}
		} else if (this.mode === 'native') {
			void this.nativeLoginService.start({
				params: {
					...extraParams,
					prompt: 'create',
					sessionId: this.sessionId,
					language: this.route.snapshot.queryParamMap.get('language'),
				},
				onLogin: async () => {
					await this.router.navigateByUrl('/profile');
				},
				onClose: () => {
					globalThis.location.reload();
				},
				onError: async (error) => {
					await this.router.navigate(['/error'], { queryParams: { error: error.message } });
				},
				onFallback: (error) => {
					globalThis.location.href = error.url.toString();
				},
				onGlobalMessage: (message) => {
					alert(message.text);
				},
			});
		}
	}

	protected onEmbeddedLogin(): void {
		void this.router.navigateByUrl('/profile');
	}

	protected onEmbeddedClose(): void {
		globalThis.location.reload();
	}

	protected onEmbeddedError(event: Event): void {
		alert((event as CustomEvent<string>).detail ?? (event as ErrorEvent).message ?? 'Unknown error');
	}
}
