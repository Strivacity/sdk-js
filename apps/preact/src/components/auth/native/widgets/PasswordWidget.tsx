import type { ChangeEvent, KeyboardEvent } from 'preact/compat';
import type { PasswordWidget } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/compat';
import { useNativeLoginContext } from '@strivacity/sdk-preact';

export default function Password({ formId, config }: { formId: string; config: PasswordWidget }) {
	const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
	const value = forms[formId]?.[config.id] as string;
	const disabled = !!loading;
	const errorMessage = messages[formId]?.[config.id]?.text;

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
		<div data-widget="password" data-form-id={formId} data-widget-id={config.id}>
			{config.label && (
				<label htmlFor={config.id} className="label">
					{config.label}
				</label>
			)}
			<input id={config.id} name={config.id} readOnly={disabled} type="password" required size={1} onChange={onChange} onKeyDown={onKeyDown} />
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
