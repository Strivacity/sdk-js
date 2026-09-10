import type { ChangeEvent, KeyboardEvent } from 'react';
import type { DateWidget } from '@strivacity/sdk-react';
import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { useNativeLoginContext } from '@strivacity/sdk-react';

const fieldLengths = { year: 4, month: 2, day: 2 };
const placeholders = { year: 'YYYY', month: 'MM', day: 'DD' };
const fields: Array<'year' | 'month' | 'day'> = ['year', 'month', 'day'];

export default function DateField({ formId, config }: { formId: string; config: DateWidget }) {
	const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
	const value = (forms[formId]?.[config.id] as string) || config.value;
	const disabled = !!loading || !!config.readonly;
	const errorMessage = messages[formId]?.[config.id]?.text;
	const validator = config.validator;
	const [year, setYear] = useState('');
	const [month, setMonth] = useState('');
	const [day, setDay] = useState('');
	const fieldValues = { year, month, day };

	useEffect(() => {
		if (!value) {
			return;
		}

		setFormValue(formId, config.id, value);

		const date = DateTime.fromISO(value);

		if (date.isValid) {
			const [y, m, d] = value.split('-');

			setYear(y || '');
			setMonth(m || '');
			setDay(d || '');
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onFieldsetChange = (event: ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		const input = event.target;
		const field = input.name;
		let nextYear = year;
		let nextMonth = month;
		let nextDay = day;

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

		setFormValue(formId, config.id, nextValue.toISODate());
	};

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		setFormValue(formId, config.id, event.target.value);
	};

	const onKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
		if (disabled || event.key !== 'Enter') {
			return;
		}

		const input = event.currentTarget;

		if (input.reportValidity()) {
			setFormValue(formId, config.id, input.value);
			await submitForm(formId);
		}
	};

	return (
		<div data-widget="date" data-form-id={formId} data-widget-id={config.id}>
			{config.label && (
				<label htmlFor={config.id} className="label">
					{config.label}
				</label>
			)}
			{config.render?.type === 'fieldSet' ? (
				<div style={{ gridTemplateColumns: `${fieldLengths.year}fr ${fieldLengths.month}fr ${fieldLengths.day}fr` }} className="fieldset">
					{fields.map((field) => (
						<input
							key={field}
							name={field}
							readOnly={disabled}
							required={validator?.required}
							value={fieldValues[field]}
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
					id={config.id}
					name={config.id}
					readOnly={disabled}
					required={validator?.required}
					defaultValue={value}
					type="date"
					size={1}
					onChange={onChange}
					onKeyDown={onKeyDown}
				/>
			)}
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
