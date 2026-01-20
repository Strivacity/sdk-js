/* eslint-disable @typescript-eslint/no-explicit-any */

import { Component, OnDestroy, OnInit, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SDKOptions, StrivacityAuthService, FallbackError, StyLoginRenderer, LoginFlowState, type ExtraRequestArgs } from '@strivacity/sdk-angular';
import { type ImportMeta } from '../../app.config';
import { widgets } from '../../components/widgets';

@Component({
	standalone: true,
	imports: [StyLoginRenderer],
	selector: 'app-register-page',
	templateUrl: './register.page.html',
})
export class RegisterPage implements OnInit, OnDestroy {
	readonly widgets = widgets;
	readonly subscription = new Subscription();
	sessionId: string | null = null;
	options: SDKOptions;
	extraParams: ExtraRequestArgs = {
		prompt: 'create',
		loginHint: (import.meta as unknown as ImportMeta).env.VITE_LOGIN_HINT,
		acrValues: (import.meta as unknown as ImportMeta).env.VITE_ACR_VALUES ? (import.meta as unknown as ImportMeta).env.VITE_ACR_VALUES.split(' ') : undefined,
		uiLocales: (import.meta as unknown as ImportMeta).env.VITE_UI_LOCALES ? (import.meta as unknown as ImportMeta).env.VITE_UI_LOCALES.split(' ') : undefined,
		audiences: (import.meta as unknown as ImportMeta).env.VITE_AUDIENCES ? (import.meta as unknown as ImportMeta).env.VITE_AUDIENCES.split(' ') : undefined,
	};

	constructor(
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService,
	) {
		this.options = this.strivacityAuthService.options;

		if (window.location.search !== '') {
			const url = new URL(window.location.href);
			this.sessionId = url.searchParams.get('session_id');
			url.search = '';
			history.replaceState({}, '', url.toString());
		}
	}

	ngOnInit() {
		if (this.options?.mode === 'redirect') {
			this.subscription.add(
				// @ts-expect-error: Ignore SDK type mismatch for register
				this.strivacityAuthService.register(this.extraParams).subscribe({
					next: () => {},
					error: (error: any) => this.onError(error),
				}),
			);
		} else if (this.options?.mode === 'popup') {
			this.subscription.add(
				// @ts-expect-error: Ignore SDK type mismatch for register
				this.strivacityAuthService.register(this.extraParams).subscribe({
					next: () => {
						void this.router.navigateByUrl('/profile');
					},
					error: (error: any) => this.onError(error),
				}),
			);
		}
	}

	ngOnDestroy() {
		this.subscription.unsubscribe();
	}

	onLogin() {
		void this.router.navigateByUrl('/profile');
	}

	onFallback(error: FallbackError) {
		if (error.url) {
			location.href = error.url.toString();
		} else {
			alert(error);
		}
	}

	onClose() {
		location.reload();
	}

	onError(error: any) {
		alert(error);
	}

	onGlobalMessage(message: string) {
		alert(message);
	}

	onBlockReady(_events: { previousState: LoginFlowState; state: LoginFlowState }) {
		// You can handle block ready events here
	}
}
