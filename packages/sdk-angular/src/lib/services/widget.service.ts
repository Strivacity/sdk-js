import type { LoginFlowMessage, LoginFlowState } from '@strivacity/sdk-core';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NativeFlowState {
	loading: boolean;
	formContexts: Record<string, Record<string, unknown>>;
	messageContexts: Record<string, Record<string, string | null>>;
	state: LoginFlowState;
}

/**
 * Service that manages Strivacity native widgets.
 */
@Injectable({
	providedIn: 'root',
})
export class StrivacityWidgetService {
	readonly loading$ = new BehaviorSubject<boolean>(false);
	readonly forms$ = new BehaviorSubject<Record<string, Record<string, unknown>>>({});
	readonly messages$ = new BehaviorSubject<Record<string, Record<string, LoginFlowMessage>>>({});
	readonly state$ = new BehaviorSubject<LoginFlowState>({});

	triggerFallback!: (hostedUrl?: string) => void;
	submitForm!: (formId: string) => Promise<void>;

	setFormValue(formId: string, widgetId: string, value: unknown) {
		const forms = { ...this.forms$.value };
		forms[formId] = { ...(forms[formId] || {}), [widgetId]: value === '' ? null : value };

		this.forms$.next(forms);
	}

	setMessage(formId: string, widgetId: string, value: LoginFlowMessage) {
		const messages = { ...this.messages$.value };
		messages[formId] = { ...(messages[formId] || {}), [widgetId]: value };

		this.messages$.next(messages);
	}
}
