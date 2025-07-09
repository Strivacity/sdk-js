import React, { useContext, useMemo } from 'react';
import type { PasscodeWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-react';
import './passcode.widget.scss';

export function PasscodeWidget({ formId, config }: { formId: string; config: PasscodeWidget }) {
	const context = useContext(NativeFlowContext);
	const disabled = useMemo(() => !!context?.loading, [context?.loading]);
	const errorMessage = context?.messages[formId]?.[config.id]?.text;

	const onInput = (event: React.FormEvent<HTMLInputElement>) => {
		const inputElement = event.target as HTMLInputElement;
		inputElement.value = inputElement.value.replace(/\D/g, '');
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
		<div data-widget="passcode" data-form-id={formId} data-widget-id={config.id}>
			{config.label && (
				<label htmlFor={config.id} className="label">
					{config.label}
				</label>
			)}
			<input
				id={config.id}
				name={config.id}
				type={config.type}
				readOnly={disabled}
				minLength={config.validator?.length}
				maxLength={config.validator?.length}
				autoComplete="off"
				inputMode="numeric"
				size={1}
				onInput={(e) => onInput(e)}
				onChange={(e) => onChange(e)}
				onKeyDown={(e) => void onKeyDown(e)}
			/>
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
