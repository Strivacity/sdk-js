import type { ComponentRef, OnDestroy } from '@angular/core';
import type { Widget } from '@strivacity/sdk-angular';
import { Component, ViewChild, ViewContainerRef, effect, inject } from '@angular/core';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';
import { LayoutWidgetComponent } from './widgets';
import { NativeLoginWidgetRendererComponent } from './native-login-widget-renderer';

// NativeLoginWidgetRendererComponent walks the layout tree and, for each placeholder
// looks up its widget data by id in the current forms and picks the matching Angular component from the `widgets` map
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
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	@ViewChild('container', { read: ViewContainerRef, static: true })
	readonly containerRef!: ViewContainerRef;

	readonly loading = this.nativeLoginService.loading;
	readonly state = this.nativeLoginService.state;

	refs: Array<ComponentRef<unknown>> = [];

	constructor() {
		effect(() => this.render());
	}

	ngOnDestroy(): void {
		this.destroyRefs();
	}

	render(): void {
		const state = this.state();

		this.destroyRefs();

		if (!state.screen) {
			return;
		}

		const rendererRef = this.containerRef.createComponent(NativeLoginWidgetRendererComponent);

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
