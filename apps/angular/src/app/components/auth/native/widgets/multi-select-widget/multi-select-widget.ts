import { Component, type ElementRef, type OnInit, afterRenderEffect, computed, inject, input, viewChild } from '@angular/core';
import type { MultiSelectWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-multi-select-widget',
	templateUrl: './multi-select-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class MultiSelectWidgetComponent implements OnInit {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<MultiSelectWidget>();

	readonly selectedValues = computed(() => (this.nativeLoginService.forms()[this.formId()]?.[this.config().id] as Array<string> | undefined) ?? []);
	readonly disabled = computed(() => this.nativeLoginService.loading() || !!this.config().readonly);
	readonly minSelectable = computed(() => this.config().validator?.minSelectable ?? 0);
	readonly maxSelectable = computed(() => this.config().validator?.maxSelectable ?? Infinity);
	readonly container = viewChild<ElementRef<HTMLElement>>('container');
	readonly errorMessage = computed(() => this.nativeLoginService.messages()[this.formId()]?.[this.config().id]?.text);

	constructor() {
		afterRenderEffect(() => {
			const message = this.selectedValues().length < this.minSelectable() ? `Select at least ${this.minSelectable()} option(s).` : '';
			this.container()?.nativeElement.querySelector('input')?.setCustomValidity(message);
		});
	}

	ngOnInit(): void {
		const value = (this.nativeLoginService.forms()[this.formId()]?.[this.config().id] as Array<string> | undefined) ?? this.config().value;

		if (value) {
			this.nativeLoginService.setFormValue(this.formId(), this.config().id, value);
		}
	}

	isDisabled(value: string): boolean {
		const selectedValues = this.selectedValues();

		return this.disabled() || (!selectedValues.includes(value) && selectedValues.length >= this.maxSelectable());
	}

	onChange(event: Event): void {
		const value = (event.target as HTMLInputElement).value;

		if (this.isDisabled(value)) {
			return;
		}

		const values = this.selectedValues();

		this.nativeLoginService.setFormValue(this.formId(), this.config().id, values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
	}
}
