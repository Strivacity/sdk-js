import type { OnInit, OnDestroy, ComponentRef } from '@angular/core';
import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
import type { IdTokenClaims, NativeParams, WidgetType, LoginFlowState, LoginFlowMessage, Widget } from '@strivacity/sdk-core';
import { Component, EventEmitter, Input, Output, Type, ViewChild, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { FallbackError } from '@strivacity/sdk-core';
import { StrivacityAuthService } from '../services/auth.service';
import { StrivacityWidgetService } from '../services/widget.service';
import { unflattenObject } from '@strivacity/sdk-core/utils/object';
import { StyWidgetRenderer } from './widget-renderer.component';

@Component({
	standalone: true,
	// eslint-disable-next-line @angular-eslint/component-selector
	selector: 'sty-login-renderer',
	template: '<ng-container #container></ng-container>',
	host: {
		class: 'login-renderer',
	},
})
export class StyLoginRenderer implements OnInit, OnDestroy {
	private subscriptions = new Subscription();
	private stateSub?: Subscription;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private createdComponentRefs: ComponentRef<any>[] = [];
	loginHandler!: ReturnType<StrivacityAuthService<NativeFlow>['sdk']['login']>;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	@Input({ required: true }) widgets!: Record<WidgetType, Type<any>>;
	@Input() sessionId?: string | null;
	@Input() params: NativeParams = {};

	@Output('login') readonly onLogin = new EventEmitter<IdTokenClaims | null | undefined>();
	@Output('fallback') readonly onFallback = new EventEmitter<FallbackError>();
	@Output('close') readonly onClose = new EventEmitter();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	@Output('error') readonly onError = new EventEmitter<any>();
	@Output('globalMessage') readonly onGlobalMessage = new EventEmitter<string>();
	@Output('blockReady') readonly onBlockReady = new EventEmitter<{ previousState: LoginFlowState; state: LoginFlowState }>();

	@ViewChild('container', { read: ViewContainerRef, static: true }) readonly $containerRef!: ViewContainerRef;

	constructor(
		protected authService: StrivacityAuthService<NativeFlow>,
		protected widgetService: StrivacityWidgetService,
	) {
		this.widgetService.triggerFallback = (hostedUrl?: string) => {
			const url = hostedUrl || this.widgetService.state$.value.hostedUrl;

			if (!url) {
				throw new Error('No hosted URL provided');
			}

			this.onFallback.emit(new FallbackError(new URL(url)));
		};
		this.widgetService.triggerClose = () => {
			this.onClose.emit();
		};
		this.widgetService.submitForm = async (formId: string) => {
			try {
				this.widgetService.loading$.next(true);

				const data = await this.loginHandler.submitForm(formId, unflattenObject(this.widgetService.forms$.value[formId]));

				if (await this.authService.sdk.isAuthenticated) {
					this.onLogin.emit(this.authService.sdk.idTokenClaims);
				} else {
					const previousState = JSON.parse(JSON.stringify(this.widgetService.state$.value));
					const newState: LoginFlowState = {
						hostedUrl: data?.hostedUrl ?? this.widgetService.state$.value.hostedUrl,
						finalizeUrl: data?.finalizeUrl ?? this.widgetService.state$.value.finalizeUrl,
						screen: data?.screen ?? this.widgetService.state$.value.screen,
						forms: data?.forms ?? this.widgetService.state$.value.forms,
						layout: data?.layout ?? this.widgetService.state$.value.layout,
						messages: data?.messages ?? this.widgetService.state$.value.messages,
						branding: data?.branding ?? this.widgetService.state$.value.branding,
					};

					if (newState.screen !== this.widgetService.state$.value.screen) {
						const forms: Record<string, Record<string, unknown>> = {};
						const messages: Record<string, Record<string, LoginFlowMessage>> = {};

						for (const form of newState.forms ?? []) {
							forms[form.id] = {};
							messages[form.id] = {};
						}

						this.widgetService.forms$.next(forms);
						this.widgetService.messages$.next(messages);
					}

					Object.keys(newState.messages ?? {}).forEach((formId) => {
						if (formId === 'global') {
							this.onGlobalMessage.emit(newState.messages?.global?.text ?? '');
						} else {
							const messages = { ...this.widgetService.messages$.value };
							messages[formId] = newState.messages![formId];
							this.widgetService.messages$.next(messages);
						}
					});

					this.widgetService.state$.next(newState);
					this.onBlockReady.emit({ previousState, state: structuredClone(newState) });
					this.widgetService.loading$.next(false);
				}
			} catch (error) {
				if (error instanceof FallbackError) {
					this.onFallback.emit(error);
				} else {
					this.onError.emit(error);
				}
			}
		};
	}

	ngOnInit() {
		this.subscriptions.add(
			this.widgetService.state$.subscribe((state) => {
				this.render(state);
			}),
		);
		void this.init();
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
		this.clearAndDestroyComponents();
	}

	async init() {
		try {
			this.loginHandler = this.authService.sdk.login(this.params);

			const data = (await this.loginHandler.startSession(this.sessionId)) as LoginFlowState;
			const previousState = JSON.parse(JSON.stringify(this.widgetService.state$.value));
			const newState = {
				hostedUrl: data?.hostedUrl ?? this.widgetService.state$.value.hostedUrl,
				finalizeUrl: data?.finalizeUrl ?? this.widgetService.state$.value.finalizeUrl,
				screen: data?.screen ?? this.widgetService.state$.value.screen,
				forms: data?.forms ?? this.widgetService.state$.value.forms,
				layout: data?.layout ?? this.widgetService.state$.value.layout,
				messages: data?.messages ?? this.widgetService.state$.value.messages,
				branding: data?.branding ?? this.widgetService.state$.value.branding,
			};

			if (await this.authService.sdk.isAuthenticated) {
				this.onLogin.emit(this.authService.sdk.idTokenClaims);
			} else {
				if (newState.screen !== this.widgetService.state$.value.screen) {
					const newFormContexts: Record<string, Record<string, unknown>> = {};
					const newMessageContexts: Record<string, Record<string, LoginFlowMessage>> = {};

					for (const form of newState.forms ?? []) {
						newFormContexts[form.id] = {};
						newMessageContexts[form.id] = {};
					}

					this.widgetService.forms$.next(newFormContexts);
					this.widgetService.messages$.next(newMessageContexts);
				}

				Object.keys(newState.messages ?? {}).forEach((formId) => {
					if (formId === 'global') {
						this.onGlobalMessage.emit(newState.messages?.global?.text ?? '');
					} else {
						const messages = { ...this.widgetService.messages$.value };
						messages[formId] = newState.messages![formId];

						this.widgetService.messages$.next(messages);
					}
				});

				this.widgetService.state$.next(newState);
				this.onBlockReady.emit({ previousState, state: structuredClone(newState) });
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				this.onFallback.emit(error);
			} else {
				this.onError.emit(error);
			}
		}
	}

	private render(state: LoginFlowState): void {
		this.clearAndDestroyComponents();

		if (state.screen) {
			const component = this.widgets['layout'];

			if (!component) {
				return this.widgetService.triggerFallback();
			}

			const widgetRendererRef = this.$containerRef.createComponent(StyWidgetRenderer);
			widgetRendererRef.setInput('items', state.layout?.items);
			widgetRendererRef.setInput('widgets', this.widgets);
			widgetRendererRef.changeDetectorRef.detectChanges();

			const layoutRef = this.$containerRef.createComponent(component, {
				projectableNodes: [[widgetRendererRef.location.nativeElement]],
			});
			layoutRef.setInput('formId', (state.layout?.items[0] as Widget)?.formId);
			layoutRef.setInput('type', state.layout?.type);
			layoutRef.setInput('tag', 'form');
			layoutRef.changeDetectorRef.detectChanges();

			this.createdComponentRefs.push(widgetRendererRef, layoutRef);
		} else {
			const loadingComponentType = this.widgets['loading'];

			if (loadingComponentType) {
				const loadingRef = this.$containerRef.createComponent(loadingComponentType);

				this.createdComponentRefs.push(loadingRef);
			}
		}
	}

	private clearAndDestroyComponents(): void {
		this.createdComponentRefs.forEach((ref) => {
			if (!ref.hostView.destroyed) {
				ref.destroy();
			}
		});
		this.createdComponentRefs = [];
		this.$containerRef?.clear();
	}
}
