import type { NativeFlowMessage, NativeLoginOptions } from '../../types';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { createNativeLoginController } from '@strivacity/sdk-core/utils';
import { StrivacityAuthService } from './auth.service';

@Injectable()
export class StrivacityNativeLoginService {
	private readonly authService = inject(StrivacityAuthService);
	private readonly controller = createNativeLoginController(() => this.authService.sdk);
	private readonly snapshot = signal(this.controller.getSnapshot());

	readonly loading = computed(() => this.snapshot().loading);
	readonly forms = computed(() => this.snapshot().forms);
	readonly messages = computed(() => this.snapshot().messages);
	readonly state = computed(() => this.snapshot().state);

	constructor() {
		const unsubscribe = this.controller.subscribe((snapshot) => this.snapshot.set(snapshot));

		inject(DestroyRef).onDestroy(unsubscribe);
	}

	/**
	 * Starts a native login flow session. Should be called once, from the page component that owns this service.
	 *
	 * @param {NativeLoginOptions} [options] - Optional options for the login session.
	 */
	async start(options: NativeLoginOptions = {}): Promise<void> {
		this.controller.setOptions(options);
		await this.controller.start();
	}

	submitForm(formId: string, customBody?: Record<string, unknown>): Promise<void> {
		return this.controller.submitForm(formId, customBody);
	}

	setFormValue(formId: string, widgetId: string, value: unknown): void {
		this.controller.setFormValue(formId, widgetId, value);
	}

	setMessage(formId: string, widgetId: string, value: NativeFlowMessage): void {
		this.controller.setMessage(formId, widgetId, value);
	}

	triggerFallback(message?: string): void {
		this.controller.triggerFallback(message);
	}

	triggerClose(): void {
		this.controller.triggerClose();
	}
}
