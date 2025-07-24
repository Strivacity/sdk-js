/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, no-console */
import { Component, OnDestroy, OnInit, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler } from '@strivacity/sdk-core/utils/handlers';
import { SDKOptions, StrivacityAuthService, FallbackError, StyLoginRenderer, LoginFlowState } from '@strivacity/sdk-angular';
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
				this.strivacityAuthService.register().subscribe({
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
				// @ts-expect-error: Ignore SDK type mismatch for register
				this.strivacityAuthService.register().subscribe({
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
