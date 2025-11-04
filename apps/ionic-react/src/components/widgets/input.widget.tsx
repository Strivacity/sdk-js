import React, { useContext, useEffect, useMemo } from 'react';
import type { InputWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-react';
import './input.widget.scss';

export function InputWidget({ formId, config }: { formId: string; config: InputWidget }) {
	const context = useContext(NativeFlowContext);
	const value = (context?.forms[formId]?.[config.id] as string) ?? config.value ?? '';
	const errorMessage = context?.messages[formId]?.[config.id]?.text;
	const disabled = useMemo(() => !!context?.loading || !!config.readonly, [context?.loading, config.readonly]);
	const autocomplete = useMemo(() => {
		if (config.autocomplete && config.render?.autocompleteHint) {
			return `${config.autocomplete} ${config.render.autocompleteHint}`;
		} else if (config.autocomplete) {
			return config.autocomplete;
		} else {
			return 'on';
		}
	}, [config.autocomplete, config.render?.autocompleteHint]);

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
		<div data-widget="input" data-form-id={formId} data-widget-id={config.id}>
			{config.label && (
				<label htmlFor={config.id} className="label">
					{config.label}
				</label>
			)}
			<input
				id={config.id}
				name={config.id}
				autoComplete={autocomplete}
				inputMode={config.inputmode}
				readOnly={disabled}
				required={config.validator?.required}
				minLength={config.validator?.minLength}
				maxLength={config.validator?.maxLength}
				pattern={config.validator?.regex}
				value={value}
				type="text"
				size={1}
				onChange={(e) => onChange(e)}
				onKeyDown={(e) => void onKeyDown(e)}
			/>
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
