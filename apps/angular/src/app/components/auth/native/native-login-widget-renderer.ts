import type { ComponentRef, OnDestroy } from '@angular/core';
import type { AnyWidget, LayoutWidget, Widget } from '@strivacity/sdk-angular';
import { Component, ViewChild, ViewContainerRef, effect, inject, input } from '@angular/core';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';
import { LayoutWidgetComponent, widgets } from './widgets';

// Recursively renders a screen's layout tree. Each `item` is either:
// - { type: 'widget', formId, widgetId }: a placeholder resolved against the current forms/widgets
// - { type: 'vertical' | 'horizontal', items }: a nested group, rendered inside another layout widget
@Component({
	selector: 'app-native-login-widget-renderer',
	template: '<ng-container #container></ng-container>',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class NativeLoginWidgetRendererComponent implements OnDestroy {
	// useNativeLoginContext() reads the state/actions provided by the nativeLoginService
	// that mounted this tree (see NativeLoginComponent), without needing them passed down as props
	readonly nativeLoginService = inject(StrivacityNativeLoginService);
	refs: Array<ComponentRef<unknown>> = [];

	readonly items = input<LayoutWidget['items']>([]);

	@ViewChild('container', { read: ViewContainerRef, static: true })
	readonly containerRef!: ViewContainerRef;

	constructor() {
		effect(() => this.render(this.items()));
	}

	ngOnDestroy(): void {
		this.destroyRefs();
	}

	render(items: LayoutWidget['items']): void {
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
				const rendererRef = this.containerRef.createComponent(NativeLoginWidgetRendererComponent);

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

	resolveWidget(formId: string, widgetId: string): AnyWidget | undefined {
		const form = this.nativeLoginService.state().forms?.find((f) => f.id === formId);
		const widget = form?.widgets.find((w) => w.id === widgetId) as AnyWidget | undefined;

		if (!form || !widget) {
			// triggerFallback() bails out to the hosted (non-native) journey when something
			// unexpected happens, e.g. the SDK sent a screen this UI doesn't know how to render
			this.nativeLoginService.triggerFallback(`Unable to find form or widget for item: formId=${formId}, widgetId=${widgetId}`);
			return undefined;
		}

		if (!widgets[widget.type]) {
			this.nativeLoginService.triggerFallback(`No component found for widget type ${widget.type}`);
			return undefined;
		}

		return widget;
	}

	destroyRefs(): void {
		for (const ref of this.refs) {
			if (!ref.hostView.destroyed) {
				ref.destroy();
			}
		}

		this.refs = [];
		this.containerRef?.clear();
	}
}
