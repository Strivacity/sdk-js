import React, { useContext, useMemo } from 'react';
import type { PasswordWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-remix';
import './password.widget.scss';

export function PasswordWidget({ formId, config }: { formId: string; config: PasswordWidget }) {
	const context = useContext(NativeFlowContext);
	const disabled = useMemo(() => !!context?.loading, [context?.loading]);
	const errorMessage = context?.messages[formId]?.[config.id]?.text;

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
		<div data-widget="password" data-form-id={formId} data-widget-id={config.id}>
			{config.label && (
				<label htmlFor={config.id} className="label">
					{config.label}
				</label>
			)}
			<input
				id={config.id}
				name={config.id}
				readOnly={disabled}
				type="password"
				required
				size={1}
				onChange={(e) => onChange(e)}
				onKeyDown={(e) => void onKeyDown(e)}
			/>
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
