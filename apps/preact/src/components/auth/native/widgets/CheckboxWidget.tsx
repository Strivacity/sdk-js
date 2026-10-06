import type { ChangeEvent } from 'preact/compat';
import type { CheckboxWidget } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/compat';
import { useNativeLoginContext } from '@strivacity/sdk-preact';

export default function Checkbox({ formId, config }: { formId: string; config: CheckboxWidget }) {
	const { loading, forms, messages, setFormValue } = useNativeLoginContext();
	const disabled = !!loading || !!config.readonly;
	const checked = (forms[formId]?.[config.id] as boolean | undefined) ?? config.value ?? false;
	const errorMessage = messages[formId]?.[config.id]?.text;

	useEffect(() => {
		setFormValue(formId, config.id, checked);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		setFormValue(formId, config.id, event.currentTarget.checked);
	};

	return (
		<div data-widget="checkbox" data-form-id={formId} data-widget-id={config.id}>
			<div>
				<input
					id={config.id}
					name={config.id}
					disabled={disabled}
					required={config.validator?.required}
					checked={checked}
					type="checkbox"
					size={1}
					onChange={onChange}
				/>
				{config.label && (
					<label htmlFor={config.id} className="label">
						{config.label}
					</label>
				)}
			</div>
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
