import type { Type, SimpleChanges, OnChanges } from '@angular/core';
import type { WidgetType, LayoutWidget, Widget } from '@strivacity/sdk-core';
import { Component, Input, ViewContainerRef, ViewChild } from '@angular/core';
import { StrivacityWidgetService } from '../services/widget.service';

@Component({
	standalone: true,
	// eslint-disable-next-line @angular-eslint/component-selector
	selector: 'sty-widget-renderer',
	template: '<ng-container #container></ng-container>',
	styles: `
		:host {
			display: contents;
		}
	`,
})
export class StyWidgetRenderer implements OnChanges {
	@Input() items: LayoutWidget['items'] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	@Input({ required: true }) widgets!: Record<WidgetType, Type<any>>;

	@ViewChild('container', { read: ViewContainerRef, static: true }) readonly $containerRef!: ViewContainerRef;

	constructor(protected widgetService: StrivacityWidgetService) {}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['items']) {
			this.render();
		}
	}

	render(): void {
		this.$containerRef.clear();

		if (!this.items) {
			return;
		}

		for (const item of this.items) {
			if (item.type === 'widget') {
				const form = this.widgetService.state$.value.forms?.find((f) => f.id === item.formId);
				const widget = form?.widgets.find((w) => w.id === item.widgetId);
				const component = widget ? this.widgets[widget.type] : undefined;

				if (!form || !widget) {
					this.widgetService.triggerFallback(undefined, `Unable to find form or widget for item: formId=${item.formId}, widgetId=${item.widgetId}`);
					continue;
				}

				if (!component) {
					this.widgetService.triggerFallback(undefined, `No component found for widget type ${widget.type}`);
					continue;
				}

				const componentRef = this.$containerRef.createComponent(component);
				componentRef.setInput('formId', item.formId);
				componentRef.setInput('config', widget);
				componentRef.changeDetectorRef.detectChanges();
			} else if (item.type === 'vertical' || item.type === 'horizontal') {
				const component = this.widgets.layout;

				if (!component) {
					this.widgetService.triggerFallback(undefined, 'No layout component provided');
					continue;
				}

				const widgetRendererRef = this.$containerRef.createComponent(StyWidgetRenderer);
				widgetRendererRef.setInput('items', item.items);
				widgetRendererRef.setInput('widgets', this.widgets);
				widgetRendererRef.changeDetectorRef.detectChanges();

				const layoutRef = this.$containerRef.createComponent(component, {
					projectableNodes: [[widgetRendererRef.location.nativeElement]],
				});
				layoutRef.setInput('formId', (item.items[0] as Widget)?.formId);
				layoutRef.setInput('type', item.type);
				layoutRef.changeDetectorRef.detectChanges();
			} else {
				this.widgetService.triggerFallback(undefined, 'Unknown item type in layout');
			}
		}
	}
}
