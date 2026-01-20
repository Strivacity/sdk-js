/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises */
import { Component, OnDestroy, OnInit, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler } from '@strivacity/sdk-core/utils/handlers';
import { SDKOptions, StrivacityAuthService, FallbackError, StyLoginRenderer, LoginFlowState, type ExtraRequestArgs } from '@strivacity/sdk-angular';
import { type ImportMeta } from '../../app.config';
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
	extraParams: ExtraRequestArgs = {
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
				// @ts-expect-error: Ignore SDK type mismatch for login
				this.strivacityAuthService.login(this.extraParams).subscribe({
					next: async () => {
						if (Capacitor.getPlatform() !== 'web') {
							const params = (await this.options.callbackHandler!(this.options.redirectUri, this.options.responseMode || 'fragment')) as Record<string, string>;
							await this.strivacityAuthService.sdk.tokenExchange(params);
							await this.router.navigateByUrl('/profile');
						}
					},
					error: (error: any) => this.onError(error),
				}),
			);
		} else if (this.options?.mode === 'popup') {
			this.subscription.add(
				// @ts-expect-error: Ignore SDK type mismatch for login
				this.strivacityAuthService.login(this.extraParams).subscribe({
					next: async () => {
						await this.router.navigateByUrl('/profile');
					},
					error: (error: any) => this.onError(error),
				}),
			);
		}
	}

	ngOnDestroy() {
		this.subscription.unsubscribe();
	}

	async onLogin() {
		await this.router.navigateByUrl('/profile');
	}

	async onFallback(error: FallbackError) {
		if (error.url) {
			if (Capacitor.getPlatform() === 'web') {
				return redirectUrlHandler(error.url.toString());
			} else {
				await InAppBrowser.openInWebView({ url: error.url.toString(), options: DefaultWebViewOptions });

				// eslint-disable-next-line no-async-promise-executor
				const params = await new Promise<Record<string, string>>(async (resolve, reject) => {
					let navigationListener: PluginListenerHandle | null = null;
					let finishListener: PluginListenerHandle | null = null;
					let userCancelled = true;

					const cleanupListeners = async () => {
						if (navigationListener) {
							await navigationListener.remove();
							navigationListener = null;
						}

						if (finishListener) {
							await finishListener.remove();
							finishListener = null;
						}
					};

					try {
						navigationListener = await InAppBrowser.addListener('browserPageNavigationCompleted', async (event) => {
							const navigatedUrl = event.url;

							if (navigatedUrl && navigatedUrl.startsWith(this.options.redirectUri)) {
								try {
									const urlInstance = new URL(navigatedUrl);
									const dataString = this.options.responseMode === 'query' ? urlInstance.search : urlInstance.hash;
									const params = Object.fromEntries(new URLSearchParams(dataString.slice(1)));

									userCancelled = false;
									await InAppBrowser.close();
									resolve(params);
								} catch (error) {
									await InAppBrowser.close();
									reject(error);
								}
							}
						});
						finishListener = await InAppBrowser.addListener('browserClosed', async () => {
							await cleanupListeners();

							if (userCancelled) {
								reject(new Error('InAppBrowser flow cancelled by user.'));
							}
						});
					} catch (error) {
						reject(error);
					}
				});

				if (params.session_id) {
					await this.router.navigateByUrl(`/callback?session_id=${params.session_id}`);
				} else {
					await this.strivacityAuthService.sdk.tokenExchange(params);
					await this.router.navigateByUrl('/profile');
				}
			}
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
