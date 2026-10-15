import type { ChangeEvent } from 'preact/compat';
import type { SelectWidget } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/compat';
import { useNativeLoginContext } from '@strivacity/sdk-preact';

export default function Select({ formId, config }: { formId: string; config: SelectWidget }) {
	const { loading, forms, messages, setFormValue } = useNativeLoginContext();
	const formValues = forms[formId] ?? {};
	const value = (forms[formId]?.[config.id] as string | undefined) ?? config.value;
	const disabled = !!loading || !!config.readonly;
	const errorMessage = messages[formId]?.[config.id]?.text;
	const validator = config.validator;

	useEffect(() => {
		let initialValue = value;

		// A dropdown always shows an option as selected, so store it to keep the submitted value in sync with the UI
		if (!initialValue && config.render?.type !== 'radio') {
			const [firstOption] = config.options.flatMap((option) => (option.type === 'group' ? option.options : [option]));
			initialValue = firstOption?.value;
		}

		if (initialValue) {
			setFormValue(formId, config.id, initialValue);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		if (disabled) {
			return;
		}

		setFormValue(formId, config.id, event.currentTarget.value);
	};

	if (config.render?.type === 'radio') {
		return (
			<div data-widget="select" data-form-id={formId} data-widget-id={config.id}>
				{config.options.map((option) => (
					<div key={option.label} className="group">
						{option.type === 'group' ? (
							<>
								<p>{option.label}</p>
								{option.options.map((subOption) => (
									<div key={subOption.value} className="item">
										<input
											id={`${config.id}-${subOption.value}`}
											type="radio"
											name={config.id}
											disabled={disabled}
											required={validator?.required}
											value={subOption.value}
											checked={subOption.value === formValues[config.id]}
											onChange={onChange}
										/>
										<label htmlFor={`${config.id}-${subOption.value}`}>{subOption.label}</label>
									</div>
								))}
							</>
						) : (
							<div className="item">
								<input
									id={`${config.id}-${option.value}`}
									type="radio"
									name={config.id}
									disabled={disabled}
									required={validator?.required}
									value={option.value}
									checked={option.value === formValues[config.id]}
									onChange={onChange}
								/>
								<label htmlFor={`${config.id}-${option.value}`}>{option.label}</label>
							</div>
						)}
					</div>
				))}
				{errorMessage && <small className="error">{errorMessage}</small>}
			</div>
		);
	}

	return (
		<div data-widget="select" data-form-id={formId} data-widget-id={config.id}>
			{config.label && (
				<label htmlFor={config.id} className="label">
					{config.label}
				</label>
			)}
			<select id={config.id} name={config.id} disabled={disabled} required={validator?.required} size={1} defaultValue={value} onChange={onChange}>
				{config.options.map((option) =>
					option.type === 'group' ? (
						<optgroup key={option.label} label={option.label}>
							{option.options.map((subOption) => (
								<option key={subOption.value} value={subOption.value}>
									{subOption.label}
								</option>
							))}
						</optgroup>
					) : (
						<option key={option.label} value={option.value}>
							{option.label}
						</option>
					),
				)}
			</select>
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
