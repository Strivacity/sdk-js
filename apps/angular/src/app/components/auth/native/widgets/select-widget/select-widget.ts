import { Component, type OnInit, computed, inject, input } from '@angular/core';
import type { SelectWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-select-widget',
	templateUrl: './select-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class SelectWidgetComponent implements OnInit {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<SelectWidget>();

	readonly formValues = computed(() => this.nativeLoginService.forms()[this.formId()] ?? {});
	readonly disabled = computed(() => this.nativeLoginService.loading() || !!this.config().readonly);
	readonly errorMessage = computed(() => this.nativeLoginService.messages()[this.formId()]?.[this.config().id]?.text);

	ngOnInit(): void {
		const config = this.config();
		let value = (this.nativeLoginService.forms()[this.formId()]?.[config.id] as string | undefined) ?? config.value;

		// A dropdown always shows an option as selected, so store it to keep the submitted value in sync with the UI
		if (!value && config.render?.type !== 'radio') {
			const [firstOption] = config.options.flatMap((option) => (option.type === 'group' ? option.options : [option]));
			value = firstOption?.value;
		}

		if (value) {
			this.nativeLoginService.setFormValue(this.formId(), config.id, value);
		}
	}

	onChange(event: Event): void {
		if (this.disabled()) {
			return;
		}

		this.nativeLoginService.setFormValue(this.formId(), this.config().id, (event.target as HTMLInputElement).value);
	}
}
