import { Component, type OnInit, computed, inject, input, signal } from '@angular/core';
import type { DateWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';
import { DateTime } from 'luxon';

const fieldLengths = { year: 4, month: 2, day: 2 };
const placeholders = { year: 'YYYY', month: 'MM', day: 'DD' };

@Component({
	selector: 'app-date-widget',
	templateUrl: './date-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class DateWidgetComponent implements OnInit {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<DateWidget>();

	readonly fieldLengths = fieldLengths;
	readonly placeholders = placeholders;
	readonly format: Array<'year' | 'month' | 'day'> = ['year', 'month', 'day'];

	readonly value = computed(() => (this.nativeLoginService.forms()[this.formId()]?.[this.config().id] as string) || this.config().value);
	readonly disabled = computed(() => this.nativeLoginService.loading() || !!this.config().readonly);
	readonly errorMessage = computed(() => this.nativeLoginService.messages()[this.formId()]?.[this.config().id]?.text);

	readonly yearSignal = signal('');
	readonly monthSignal = signal('');
	readonly daySignal = signal('');

	readonly fieldValues = computed(() => ({ year: this.yearSignal(), month: this.monthSignal(), day: this.daySignal() }));

	ngOnInit(): void {
		const value = this.value();

		if (!value) {
			return;
		}

		this.nativeLoginService.setFormValue(this.formId(), this.config().id, value);

		if (DateTime.fromISO(value).isValid) {
			const [y, m, d] = value.split('-');

			this.yearSignal.set(y || '');
			this.monthSignal.set(m || '');
			this.daySignal.set(d || '');
		}
	}

	onFieldsetChange(event: Event): void {
		if (this.disabled()) {
			return;
		}

		const input = event.target as HTMLInputElement;
		const field = input.name;

		if (field === 'year') {
			this.yearSignal.set(input.value.padStart(4, '0'));
		} else if (field === 'month') {
			this.monthSignal.set(input.value.padStart(2, '0'));
		} else if (field === 'day') {
			this.daySignal.set(input.value.padStart(2, '0'));
		}

		const value = DateTime.fromObject({
			year: Number(this.yearSignal()),
			month: Number(this.monthSignal()),
			day: Number(this.daySignal()),
		});

		this.nativeLoginService.setFormValue(this.formId(), this.config().id, value.toISODate());
	}

	onChange(event: Event): void {
		if (this.disabled()) {
			return;
		}

		this.nativeLoginService.setFormValue(this.formId(), this.config().id, (event.target as HTMLInputElement).value);
	}

	async onKeyDown(event: Event): Promise<void> {
		if (this.disabled()) {
			return;
		}

		const input = event.target as HTMLInputElement;

		if (input.reportValidity()) {
			this.nativeLoginService.setFormValue(this.formId(), this.config().id, input.value);
			await this.nativeLoginService.submitForm(this.formId());
		}
	}
}
