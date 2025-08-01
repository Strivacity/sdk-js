import React, { useContext, useEffect, useMemo } from 'react';
import type { PhoneWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-remix';
import './phone.widget.scss';

export function PhoneWidget({ formId, config }: { formId: string; config: PhoneWidget }) {
	const context = useContext(NativeFlowContext);
	const value = (context?.forms[formId]?.[config.id] as string) ?? config.value ?? '';
	const disabled = useMemo(() => !!context?.loading || !!config.readonly, [context?.loading, config.readonly]);
	const errorMessage = context?.messages[formId]?.[config.id]?.text;

	useEffect(() => {
		// Default value handling
		if (value.length > 0) {
			context?.setFormValue(formId, config.id, value);
		}
	}, []);

	const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		context?.setFormValue(formId, config.id, event.target.value);
	};

	const onKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		const input = event.target as HTMLInputElement;

		if (event.key === 'Enter' && input.reportValidity()) {
			context?.setFormValue(formId, config.id, input.value);
			await context?.submitForm(formId);
		}
	};

	return (
		<div data-widget="phone" data-form-id={formId} data-widget-id={config.id}>
			{config.label && (
				<label htmlFor={config.id} className="label">
					{config.label}
				</label>
			)}
			<input
				id={config.id}
				name={config.id}
				type={config.type}
				autoComplete="tel"
				inputMode="tel"
				readOnly={disabled}
				required={config.validator?.required}
				value={value}
				size={1}
				onChange={(e) => onChange(e)}
				onKeyDown={(e) => void onKeyDown(e)}
			/>
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
