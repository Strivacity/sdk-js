import type { ChangeEvent, KeyboardEvent } from 'react';
import type { InputWidget } from '@strivacity/sdk-next/client';
import { useEffect } from 'react';
import { useNativeLoginContext } from '@strivacity/sdk-next/client';

export default function Input({ formId, config }: { formId: string; config: InputWidget }) {
	const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
	const value = (forms[formId]?.[config.id] as string) || config.value;
	const disabled = !!loading || !!config.readonly;
	const errorMessage = messages[formId]?.[config.id]?.text;
	const validator = config.validator;
	const autocomplete =
		config.autocomplete && config.render?.autocompleteHint ? `${config.autocomplete} ${config.render.autocompleteHint}` : (config.autocomplete ?? 'on');

	useEffect(() => {
		if (value) {
			setFormValue(formId, config.id, value);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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

		event.stopPropagation();

		const input = event.currentTarget;

		if (input.reportValidity()) {
			setFormValue(formId, config.id, input.value);
			await submitForm(formId);
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
				required={validator?.required}
				minLength={validator?.minLength}
				maxLength={validator?.maxLength}
				pattern={validator?.regex}
				defaultValue={value}
				type="text"
				size={1}
				onChange={onChange}
				onKeyDown={onKeyDown}
			/>
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
