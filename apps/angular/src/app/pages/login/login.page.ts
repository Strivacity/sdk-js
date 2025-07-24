/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { Component, OnDestroy, OnInit, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SDKOptions, StrivacityAuthService, FallbackError, StyLoginRenderer, LoginFlowState } from '@strivacity/sdk-angular';
import { widgets } from '../../components/widgets';

@Component({
	standalone: true,
	imports: [StyLoginRenderer],
	selector: 'app-login-page',
	templateUrl: './login.page.html',
})
export class LoginPage implements OnInit, OnDestroy {
	readonly widgets = widgets;
	readonly subscription = new Subscription();
	sessionId: string | null = null;
	options: SDKOptions;

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
				// @ts-expect-error: Ignore SDK type mismatch for login
				this.strivacityAuthService.login().subscribe({
					next: () => {},
					error: (error: any) => this.onError(error),
				}),
			);
		} else if (this.options?.mode === 'popup') {
			this.subscription.add(
				// @ts-expect-error: Ignore SDK type mismatch for login
				this.strivacityAuthService.login().subscribe({
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
			console.error(`FallbackError without URL: ${error.message}`);
			alert(error);
		}
	}

	onError(error: any) {
		console.error(`Error: ${error}`);
		alert(error);
	}

	onGlobalMessage(message: string) {
		alert(message);
	}

	onBlockReady({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) {
		console.log('previousState', previousState);
		console.log('state', state);
	}
}
