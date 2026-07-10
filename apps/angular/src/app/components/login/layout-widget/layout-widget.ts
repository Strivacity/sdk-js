import type { OnDestroy, OnInit } from '@angular/core';
import { Component, ElementRef, Renderer2, inject, input } from '@angular/core';
import type { LayoutWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-layout-widget',
	template: '',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class LayoutWidgetComponent implements OnInit, OnDestroy {
	private readonly elementRef = inject(ElementRef<HTMLElement>);
	private readonly renderer = inject(Renderer2);
	private readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly type = input.required<LayoutWidget['type']>();
	readonly tag = input<string>('div');
	readonly content = input<Node | null>(null);

	private unlistenSubmit: (() => void) | null = null;

	ngOnInit(): void {
		const element = this.renderer.createElement(this.tag()) as HTMLElement;

		this.renderer.setAttribute(element, 'data-widget', 'layout');
		this.renderer.setAttribute(element, 'data-type', this.type());
		this.renderer.setAttribute(element, 'data-form-id', this.formId());

		if (this.tag() === 'form') {
			this.unlistenSubmit = this.renderer.listen(element, 'submit', (event: Event) => this.onSubmit(event));
		}

		const content = this.content();

		if (content) {
			this.renderer.appendChild(element, content);
		}

		this.renderer.appendChild(this.elementRef.nativeElement, element);
	}

	ngOnDestroy(): void {
		this.unlistenSubmit?.();
	}

	private onSubmit(event: Event): void {
		event.preventDefault();

		if (this.nativeLoginService.loading()) {
			return;
		}

		void this.nativeLoginService.submitForm(this.formId());
	}
}
