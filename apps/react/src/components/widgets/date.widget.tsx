import React, { useContext, useMemo, useState, useEffect } from 'react';
import type { DateWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-react';
import { DateTime } from 'luxon';
import './date.widget.scss';

export function DateWidget({ formId, config }: { formId: string; config: DateWidget }) {
	const context = useContext(NativeFlowContext);
	const value = (context?.forms[formId]?.[config.id] as string) ?? config.value ?? '';
	const disabled = useMemo(() => !!context?.loading || !!config.readonly, [context?.loading, config.readonly]);
	const errorMessage = context?.messages[formId]?.[config.id]?.text;

	const [year, setYear] = useState<string>('');
	const [month, setMonth] = useState<string>('');
	const [day, setDay] = useState<string>('');

	const fieldLengths = { year: 4, month: 2, day: 2 };
	const placeholders = {
		year: 'YYYY',
		month: 'MM',
		day: 'DD',
	};
	const format: Array<'year' | 'month' | 'day'> = ['year', 'month', 'day'];

	useEffect(() => {
		// Default value handling
		if (value.length > 0) {
			context?.setFormValue(formId, config.id, value);
		}
	}, []);

	useEffect(() => {
		if (!value) {
			return;
		}

		const date = DateTime.fromISO(value);

		if (date.isValid) {
			const [y, m, d] = value.split('-');
			setYear(y || '');
			setMonth(m || '');
			setDay(d || '');
		}
	}, [value]);

	const onFieldsetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		const input = event.target;
		const field = input.name as 'year' | 'month' | 'day';
		const inputValue = input.value;

		if (field === 'year') {
			setYear(inputValue);
		} else if (field === 'month') {
			setMonth(inputValue);
		} else if (field === 'day') {
			setDay(inputValue);
		}

		const newYear = field === 'year' ? inputValue : year;
		const newMonth = field === 'month' ? inputValue : month;
		const newDay = field === 'day' ? inputValue : day;

		if (newYear.length === 4 && newMonth.length >= 1 && newDay.length >= 1) {
			const dateValue = DateTime.fromObject({
				year: Number(newYear),
				month: Number(newMonth),
				day: Number(newDay),
			});

			if (dateValue.isValid) {
				context?.setFormValue(formId, config.id, dateValue.toISODate());
			}
		}
	};

	const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		context?.setFormValue(formId, config.id, event.target.value);
	};

	const onKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (disabled || event.key !== 'Enter') {
			return;
		}

		event.stopPropagation();

		const input = event.target as HTMLInputElement;

		if (input.reportValidity()) {
			context?.setFormValue(formId, config.id, input.value);
			await context?.submitForm(formId);
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
				<div
					className="fieldset"
					style={{
						gridTemplateColumns: `${fieldLengths.year}fr ${fieldLengths.month}fr ${fieldLengths.day}fr`,
					}}
				>
					{format.map((field) => (
						<input
							key={field}
							name={field}
							readOnly={disabled}
							required={config.validator?.required}
							value={field === 'year' ? year : field === 'month' ? month : day}
							placeholder={placeholders[field]}
							type="text"
							size={1}
							onChange={onFieldsetChange}
							onKeyDown={(e) => void onKeyDown(e)}
						/>
					))}
				</div>
			) : (
				<input
					id={config.id}
					name={config.id}
					readOnly={disabled}
					required={config.validator?.required}
					value={value}
					type="date"
					size={1}
					onChange={onChange}
					onKeyDown={(e) => void onKeyDown(e)}
				/>
			)}

			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
