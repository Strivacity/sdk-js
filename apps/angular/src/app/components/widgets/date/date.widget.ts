import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { DateWidget as DateWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';
import { DateTime } from 'luxon';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-date-widget',
	templateUrl: './date.widget.html',
	styleUrls: ['./date.widget.scss'],
	host: {
		'data-widget': 'date',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class DateWidget {
	@Input() formId!: string;
	@Input() config!: DateWidgetConfig;

	year = '';
	month = '';
	day = '';

	readonly fieldLengths = { year: 4, month: 2, day: 2 };
	readonly placeholders = {
		year: 'YYYY',
		month: 'MM',
		day: 'DD',
	};
	readonly format: Array<'year' | 'month' | 'day'> = ['year', 'month', 'day'];

	get disabled() {
		return !!this.widgetService.loading$.value || !!this.config.readonly;
	}

	get value() {
		return (this.widgetService.forms$.value[this.formId]?.[this.config.id] as string) ?? this.config.value ?? '';
	}

	get errorMessage() {
		return this.widgetService.messages$.value[this.formId]?.[this.config.id]?.text;
	}

	get validator() {
		return this.config.validator;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {}

	ngOnInit() {
		this.setInitialValues();
	}

	private setInitialValues() {
		if (!this.value) {
			return;
		}

		const date = DateTime.fromISO(this.value);

		if (date.isValid) {
			const [y, m, d] = this.value.split('-');
			this.year = y || '';
			this.month = m || '';
			this.day = d || '';
		}
	}

	getFieldValue(field: 'year' | 'month' | 'day'): string {
		switch (field) {
			case 'year':
				return this.year;
			case 'month':
				return this.month;
			case 'day':
				return this.day;
			default:
				return '';
		}
	}

	onFieldsetChange(event: Event) {
		if (this.disabled) {
			return;
		}

		const input = event.target as HTMLInputElement;
		const field = input.name as 'year' | 'month' | 'day';
		const inputValue = input.value;

		if (field === 'year') {
			this.year = inputValue;
		} else if (field === 'month') {
			this.month = inputValue;
		} else if (field === 'day') {
			this.day = inputValue;
		}

		if (this.year.length === 4 && this.month.length >= 1 && this.day.length >= 1) {
			const dateValue = DateTime.fromObject({
				year: Number(this.year),
				month: Number(this.month),
				day: Number(this.day),
			});

			if (dateValue.isValid) {
				this.widgetService.setFormValue(this.formId, this.config.id, dateValue.toISODate());
			}
		}
	}

	onChange(event: Event) {
		if (this.disabled) {
			return;
		}

		this.widgetService.setFormValue(this.formId, this.config.id, (event.target as HTMLInputElement).value);
	}

	async onKeyDown(event: KeyboardEvent) {
		if (this.disabled || event.key !== 'Enter') {
			return;
		}

		event.stopPropagation();

		const input = event.target as HTMLInputElement;

		if (input.reportValidity()) {
			this.widgetService.setFormValue(this.formId, this.config.id, (event.target as HTMLInputElement).value);
			await this.widgetService.submitForm(this.formId);
		}
	}
}
