import type { ChangeEvent } from 'react';
import type { SelectWidget } from '@strivacity/sdk-next/client';
import { useEffect } from 'react';
import { useNativeLoginContext } from '@strivacity/sdk-next/client';

export default function Select({ formId, config }: { formId: string; config: SelectWidget }) {
	const { loading, forms, messages, setFormValue } = useNativeLoginContext();
	const formValues = forms[formId] ?? {};
	const value = (forms[formId]?.[config.id] as string) || config.value;
	const disabled = !!loading || !!config.readonly;
	const errorMessage = messages[formId]?.[config.id]?.text;
	const validator = config.validator;

	useEffect(() => {
		if (value) {
			setFormValue(formId, config.id, value);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		if (disabled) {
			return;
		}

		setFormValue(formId, config.id, event.target.value);
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
											id={subOption.value}
											type="radio"
											name={config.id}
											readOnly={disabled}
											value={subOption.value}
											checked={subOption.value === formValues[config.id]}
											onChange={onChange}
										/>
										<label htmlFor={subOption.value}>{subOption.label}</label>
									</div>
								))}
							</>
						) : (
							<div className="item">
								<input
									id={option.value}
									type="radio"
									name={config.id}
									value={option.value}
									checked={option.value === formValues[config.id]}
									onChange={onChange}
								/>
								<label htmlFor={option.value}>{option.label}</label>
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
