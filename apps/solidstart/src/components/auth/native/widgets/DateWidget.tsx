import type { DateWidget } from '@strivacity/sdk-solid/client';
import { createMemo, createSignal, onSettled } from 'solid-js';
import { DateTime } from 'luxon';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

const fieldLengths = { year: 4, month: 2, day: 2 };
const placeholders = { year: 'YYYY', month: 'MM', day: 'DD' };
const fields: Array<'year' | 'month' | 'day'> = ['year', 'month', 'day'];

export default function DateField(props: { formId: string; config: DateWidget }) {
	const ctx = useNativeLoginContext();
	const value = createMemo(() => (ctx.forms()[props.formId]?.[props.config.id] as string) || props.config.value);
	const disabled = createMemo(() => ctx.loading() || !!props.config.readonly);
	const errorMessage = createMemo(() => ctx.messages()[props.formId]?.[props.config.id]?.text);
	const validator = createMemo(() => props.config.validator);
	const [year, setYear] = createSignal('');
	const [month, setMonth] = createSignal('');
	const [day, setDay] = createSignal('');
	const fieldValues = { year, month, day };

	onSettled(() => {
		const initialValue = value();

		if (!initialValue) {
			return;
		}

		ctx.setFormValue(props.formId, props.config.id, initialValue);

		const date = DateTime.fromISO(initialValue);

		if (date.isValid) {
			const [y, m, d] = initialValue.split('-');

			setYear(y || '');
			setMonth(m || '');
			setDay(d || '');
		}
	});

	function onFieldsetChange(event: Event) {
		if (disabled()) {
			return;
		}

		const input = event.currentTarget as HTMLInputElement;
		const field = input.name as 'year' | 'month' | 'day';
		let nextYear = year();
		let nextMonth = month();
		let nextDay = day();

		if (field === 'year') {
			nextYear = input.value.padStart(4, '0');
			setYear(nextYear);
		} else if (field === 'month') {
			nextMonth = input.value.padStart(2, '0');
			setMonth(nextMonth);
		} else if (field === 'day') {
			nextDay = input.value.padStart(2, '0');
			setDay(nextDay);
		}

		const nextValue = DateTime.fromObject({ year: Number(nextYear), month: Number(nextMonth), day: Number(nextDay) });

		ctx.setFormValue(props.formId, props.config.id, nextValue.toISODate());
	}

	function onChange(event: Event) {
		if (disabled()) {
			return;
		}

		ctx.setFormValue(props.formId, props.config.id, (event.currentTarget as HTMLInputElement).value);
	}

	async function onKeyDown(event: KeyboardEvent) {
		if (disabled() || event.key !== 'Enter') {
			return;
		}

		const input = event.currentTarget as HTMLInputElement;

		if (input.reportValidity()) {
			ctx.setFormValue(props.formId, props.config.id, input.value);
			await ctx.submitForm(props.formId);
		}
	}

	return (
		<div data-widget="date" data-form-id={props.formId} data-widget-id={props.config.id}>
			{props.config.label && (
				<label for={props.config.id} class="label">
					{props.config.label}
				</label>
			)}
			{props.config.render?.type === 'fieldSet' ? (
				<div style={{ 'grid-template-columns': `${fieldLengths.year}fr ${fieldLengths.month}fr ${fieldLengths.day}fr` }} class="fieldset">
					{fields.map((field) => (
						<input
							name={field}
							readonly={disabled()}
							required={validator()?.required}
							value={fieldValues[field]()}
							placeholder={placeholders[field]}
							type="text"
							size={1}
							onChange={onFieldsetChange}
							onKeyDown={onKeyDown}
						/>
					))}
				</div>
			) : (
				<input
					id={props.config.id}
					name={props.config.id}
					readonly={disabled()}
					required={validator()?.required}
					value={value() ?? ''}
					type="date"
					size={1}
					onChange={onChange}
					onKeyDown={onKeyDown}
				/>
			)}
			{errorMessage() && <small class="error">{errorMessage()}</small>}
		</div>
	);
}
