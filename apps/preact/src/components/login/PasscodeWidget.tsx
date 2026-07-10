import type { ChangeEvent, TargetedEvent, KeyboardEvent } from 'preact/compat';
import type { PasscodeWidget } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/compat';
import { useNativeLoginContext } from '@strivacity/sdk-preact';

export default function Passcode({ formId, config }: { formId: string; config: PasscodeWidget }) {
	const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
	const value = forms[formId]?.[config.id] as string;
	const disabled = !!loading;
	const errorMessage = messages[formId]?.[config.id]?.text;
	const validator = config.validator;

	useEffect(() => {
		if (value) {
			setFormValue(formId, config.id, value);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onInput = (event: TargetedEvent<HTMLInputElement>) => {
		event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '');
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

		event.stopPropagation();

		const input = event.currentTarget;

		if (input.reportValidity()) {
			setFormValue(formId, config.id, input.value);
			await submitForm(formId);
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
				minLength={validator?.length}
				maxLength={validator?.length}
				autoComplete="off"
				inputMode="numeric"
				size={1}
				onInput={onInput}
				onChange={onChange}
				onKeyDown={onKeyDown}
			/>
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
