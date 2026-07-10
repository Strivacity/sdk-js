import type { Type, ComponentRef, OnDestroy } from '@angular/core';
import type { WidgetType, AnyWidget, LayoutWidget, Widget } from '@strivacity/sdk-angular';
import { Component, ViewChild, ViewContainerRef, effect, inject, input } from '@angular/core';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

import { CheckboxWidgetComponent } from './checkbox-widget';
import { CloseWidgetComponent } from './close-widget';
import { DateWidgetComponent } from './date-widget';
import { InputWidgetComponent } from './input-widget';
import { LayoutWidgetComponent } from './layout-widget';
import { MultiSelectWidgetComponent } from './multi-select-widget';
import { PasscodeWidgetComponent } from './passcode-widget';
import { PasskeyEnrollWidgetComponent } from './passkey-enroll-widget';
import { PasskeyLoginWidgetComponent } from './passkey-login-widget';
import { PasswordWidgetComponent } from './password-widget';
import { PhoneWidgetComponent } from './phone-widget';
import { SelectWidgetComponent } from './select-widget';
import { StaticWidgetComponent } from './static-widget';
import { SubmitWidgetComponent } from './submit-widget';
import { WebauthnEnrollWidgetComponent } from './webauthn-enroll-widget';
import { WebauthnLoginWidgetComponent } from './webauthn-login-widget';

export const widgets: Record<WidgetType, Type<unknown>> = {
	checkbox: CheckboxWidgetComponent,
	date: DateWidgetComponent,
	input: InputWidgetComponent,
	layout: LayoutWidgetComponent,
	passcode: PasscodeWidgetComponent,
	password: PasswordWidgetComponent,
	phone: PhoneWidgetComponent,
	select: SelectWidgetComponent,
	multiSelect: MultiSelectWidgetComponent,
	static: StaticWidgetComponent,
	submit: SubmitWidgetComponent,
	close: CloseWidgetComponent,
	passkeyLogin: PasskeyLoginWidgetComponent,
	passkeyEnroll: PasskeyEnrollWidgetComponent,
	webauthnLogin: WebauthnLoginWidgetComponent,
	webauthnEnroll: WebauthnEnrollWidgetComponent,
};

@Component({
	selector: 'app-native-login-renderer',
	template: `
		@if (loading() && !state().screen) {
			<p>Loading...</p>
		}
		<ng-container #container></ng-container>
	`,
	host: {
		class: 'login-renderer',
	},
	styles: [
		`
			:host {
				display: block;
			}
		`,
	],
})
export class NativeLoginRendererComponent implements OnDestroy {
	private readonly nativeLoginService = inject(StrivacityNativeLoginService);

	@ViewChild('container', { read: ViewContainerRef, static: true })
	private readonly containerRef!: ViewContainerRef;

	protected readonly loading = this.nativeLoginService.loading;
	protected readonly state = this.nativeLoginService.state;

	private refs: Array<ComponentRef<unknown>> = [];

	constructor() {
		effect(() => this.render());
	}

	ngOnDestroy(): void {
		this.destroyRefs();
	}

	private render(): void {
		const state = this.state();

		this.destroyRefs();

		if (!state.screen) {
			return;
		}

		const rendererRef = this.containerRef.createComponent(WidgetRendererComponent);

		rendererRef.setInput('items', state.layout?.items ?? []);
		rendererRef.changeDetectorRef.detectChanges();

		const layoutRef = this.containerRef.createComponent(LayoutWidgetComponent);

		layoutRef.setInput('formId', (state.layout?.items?.[0] as Widget | undefined)?.formId ?? '');
		layoutRef.setInput('type', state.layout?.type ?? 'vertical');
		layoutRef.setInput('tag', 'form');
		layoutRef.setInput('content', rendererRef.location.nativeElement);
		layoutRef.changeDetectorRef.detectChanges();

		this.refs.push(rendererRef, layoutRef);
	}

	private destroyRefs(): void {
		for (const ref of this.refs) {
			if (!ref.hostView.destroyed) {
				ref.destroy();
			}
		}

		this.refs = [];
		this.containerRef?.clear();
	}
}

@Component({
	selector: 'app-widget-renderer',
	template: '<ng-container #container></ng-container>',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class WidgetRendererComponent implements OnDestroy {
	private readonly nativeLoginService = inject(StrivacityNativeLoginService);
	refs: Array<ComponentRef<unknown>> = [];

	readonly items = input<LayoutWidget['items']>([]);

	@ViewChild('container', { read: ViewContainerRef, static: true })
	private readonly containerRef!: ViewContainerRef;

	constructor() {
		effect(() => this.render(this.items()));
	}

	ngOnDestroy(): void {
		this.destroyRefs();
	}

	private render(items: LayoutWidget['items']): void {
		this.destroyRefs();

		for (const item of items) {
			if (item.type === 'widget') {
				const widget = this.resolveWidget(item.formId, item.widgetId);

				if (!widget) {
					return;
				}

				const ref = this.containerRef.createComponent(widgets[widget.type]);

				ref.setInput('formId', item.formId);
				ref.setInput('config', widget);
				ref.changeDetectorRef.detectChanges();

				this.refs.push(ref);
			} else if (item.type === 'vertical' || item.type === 'horizontal') {
				const rendererRef = this.containerRef.createComponent(WidgetRendererComponent);

				rendererRef.setInput('items', item.items);
				rendererRef.changeDetectorRef.detectChanges();

				const layoutRef = this.containerRef.createComponent(LayoutWidgetComponent);

				layoutRef.setInput('formId', (item.items[0] as Widget | undefined)?.formId ?? '');
				layoutRef.setInput('type', item.type);
				layoutRef.setInput('content', rendererRef.location.nativeElement);
				layoutRef.changeDetectorRef.detectChanges();

				this.refs.push(rendererRef, layoutRef);
			}
		}
	}

	private resolveWidget(formId: string, widgetId: string): AnyWidget | undefined {
		const form = this.nativeLoginService.state().forms?.find((f) => f.id === formId);
		const widget = form?.widgets.find((w) => w.id === widgetId) as AnyWidget | undefined;

		if (!form || !widget) {
			this.nativeLoginService.triggerFallback(`Unable to find form or widget for item: formId=${formId}, widgetId=${widgetId}`);
			return undefined;
		}

		if (!widgets[widget.type]) {
			this.nativeLoginService.triggerFallback(`No component found for widget type ${widget.type}`);
			return undefined;
		}

		return widget;
	}

	private destroyRefs(): void {
		for (const ref of this.refs) {
			if (!ref.hostView.destroyed) {
				ref.destroy();
			}
		}

		this.refs = [];
		this.containerRef?.clear();
	}
}
