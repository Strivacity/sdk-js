import type { LoginFlowMessage, LoginFlowState, NativeParams, NativeLoginOptions } from '../../types';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { FallbackError } from '@strivacity/sdk-core/utils/errors';
import { unflattenObject } from '@strivacity/sdk-core/utils';
import { StrivacityAuthService } from './auth.service';

@Injectable()
export class StrivacityNativeLoginService {
	private readonly authService = inject(StrivacityAuthService);
	private readonly sdk = this.authService.sdk;
	private readonly abortController = new AbortController();
	private options: NativeLoginOptions = {};

	private readonly loadingSignal = signal(true);
	private readonly formsSignal = signal<Record<string, Record<string, unknown>>>({});
	private readonly messagesSignal = signal<Record<string, Record<string, LoginFlowMessage>>>({});
	private readonly stateSignal = signal<Partial<LoginFlowState>>({});

	readonly loading = this.loadingSignal.asReadonly();
	readonly forms = this.formsSignal.asReadonly();
	readonly messages = this.messagesSignal.asReadonly();
	readonly state = this.stateSignal.asReadonly();

	constructor() {
		inject(DestroyRef).onDestroy(() => this.abortController.abort());
	}

	/**
	 * Starts a native login flow session. Should be called once, from the page component that owns this service.
	 *
	 * @param {NativeLoginOptions} [options] - Optional options for the login session.
	 */
	async start(options: NativeLoginOptions = {}): Promise<void> {
		this.options = options;

		await this.sdk.init();

		try {
			await this.startSession(options.params);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			this.sdk.logging?.error('Error fetching authorization URI', error as Error);
			await this.options.onError?.(error as Error);
			this.loadingSignal.set(false);
		}
	}

	async submitForm(formId: string, customBody?: Record<string, unknown>): Promise<void> {
		try {
			this.loadingSignal.set(true);

			const nextState = await this.sdk.submitForm(formId, customBody ?? unflattenObject(this.formsSignal()[formId] ?? {}));

			if (nextState) {
				await this.handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				this.sdk.logging?.error('Fallback error occurred', error);
				await this.options.onFallback?.(error);
			} else {
				this.sdk.logging?.error('Error submitting form', error as Error);
				await this.options.onError?.(error as Error);
			}
		}
	}

	setFormValue(formId: string, widgetId: string, value: unknown): void {
		const forms = { ...this.formsSignal() };

		forms[formId] = { ...(forms[formId] ?? {}), [widgetId]: value === '' ? null : value };
		this.formsSignal.set(forms);
	}

	setMessage(formId: string, widgetId: string, value: LoginFlowMessage): void {
		const messages = { ...this.messagesSignal() };

		messages[formId] = { ...(messages[formId] ?? {}), [widgetId]: value };
		this.messagesSignal.set(messages);
	}

	triggerFallback(message?: string): void {
		this.sdk.logging?.warn(message ? `Triggering fallback due to: ${message}` : 'Triggering fallback');

		const hostedUrl = this.stateSignal().hostedUrl;

		if (!hostedUrl) {
			const error = new Error('No hosted URL provided');
			this.sdk.logging?.error('Fallback error', error);
			throw error;
		}

		void this.options.onFallback?.(new FallbackError(new URL(hostedUrl)));
	}

	triggerClose(): void {
		this.sdk.logging?.debug('Triggering close');
		void this.options.onClose?.();
	}

	private async startSession(loginParams: NativeParams = {}): Promise<void> {
		try {
			this.loadingSignal.set(true);

			const nextState = await this.sdk.startSession(loginParams);

			if (nextState) {
				await this.handleResponse(nextState);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				this.sdk.logging?.error('Fallback error occurred', error);
				await this.options.onFallback?.(error);
			} else {
				this.sdk.logging?.error('Error starting session', error as Error);
				await this.options.onError?.(error as Error);
			}
		}
	}

	private async handleResponse(nextState: Partial<LoginFlowState>): Promise<void> {
		if (this.sdk.session) {
			return await this.options.onLogin?.(this.sdk.session);
		}

		const currentState = this.stateSignal();
		const newState: LoginFlowState = {
			hostedUrl: nextState.hostedUrl ?? currentState.hostedUrl,
			finalizeUrl: nextState.finalizeUrl ?? currentState.finalizeUrl,
			screen: nextState.screen ?? currentState.screen,
			forms: nextState.forms ?? currentState.forms,
			layout: nextState.layout ?? currentState.layout,
			messages: nextState.messages ?? {},
			branding: nextState.branding ?? currentState.branding,
		};

		if (newState.screen !== currentState.screen) {
			const nextForms: Record<string, Record<string, unknown>> = {};
			const nextMessages: Record<string, Record<string, LoginFlowMessage>> = {};

			for (const form of newState.forms ?? []) {
				nextForms[form.id] = {};
				nextMessages[form.id] = {};
			}

			this.formsSignal.set(nextForms);
			this.messagesSignal.set(nextMessages);
		} else {
			this.sdk.logging?.info(`Updating screen: ${newState.screen}`);
		}

		const nextMessageMap = { ...this.messagesSignal() };

		for (const formId of Object.keys(newState.messages ?? {})) {
			if (formId === 'global') {
				await this.options.onGlobalMessage?.(newState.messages!.global!);
			} else {
				nextMessageMap[formId] = newState.messages![formId] ?? {};
			}
		}

		this.messagesSignal.set(nextMessageMap);
		this.stateSignal.set(newState);

		if (!newState.finalizeUrl) {
			this.loadingSignal.set(false);
		}
	}
}
