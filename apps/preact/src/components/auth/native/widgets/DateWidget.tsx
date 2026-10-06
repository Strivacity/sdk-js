import type { ChangeEvent, FocusEvent, KeyboardEvent } from 'preact/compat';
import type { DateWidget } from '@strivacity/sdk-preact';
import { useEffect, useState } from 'preact/compat';
import { DateTime } from 'luxon';
import { useNativeLoginContext } from '@strivacity/sdk-preact';

const fieldLengths = { year: 4, month: 2, day: 2 };
const placeholders = { year: 'YYYY', month: 'MM', day: 'DD' };
const fields: Array<'year' | 'month' | 'day'> = ['year', 'month', 'day'];

export default function DateField({ formId, config }: { formId: string; config: DateWidget }) {
	const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
	const value = (forms[formId]?.[config.id] as string | undefined) ?? config.value;
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

	const composeValue = (field: string, fieldValue: string) => {
		const next = { ...fieldValues, [field]: fieldValue };
		const nextValue = DateTime.fromObject({ year: Number(next.year), month: Number(next.month), day: Number(next.day) });

		setFormValue(formId, config.id, nextValue.toISODate());
	};

	const setFieldValue = (field: string, fieldValue: string) => {
		if (field === 'year') {
			setYear(fieldValue);
		} else if (field === 'month') {
			setMonth(fieldValue);
		} else if (field === 'day') {
			setDay(fieldValue);
		}
	};

	const onFieldsetChange = (event: ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		const input = event.currentTarget;

		setFieldValue(input.name, input.value);
		composeValue(input.name, input.value);
	};

	const onFieldsetBlur = (event: FocusEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		const input = event.currentTarget;
		const field = input.name as keyof typeof fieldLengths;

		if (input.value) {
			setFieldValue(field, input.value.padStart(fieldLengths[field], '0'));
		}
	};

	const onFieldsetKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
		if (disabled || event.key !== 'Enter') {
			return;
		}

		const input = event.currentTarget;

		if (input.reportValidity()) {
			composeValue(input.name, input.value);
			await submitForm(formId);
		}
	};

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		setFormValue(formId, config.id, event.currentTarget.value);
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
							onBlur={onFieldsetBlur}
							onKeyDown={onFieldsetKeyDown}
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
