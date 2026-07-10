import type { ChangeEvent } from 'react';
import type { MultiSelectWidget } from '@strivacity/sdk-next/client';
import { useEffect } from 'react';
import { useNativeLoginContext } from '@strivacity/sdk-next/client';

export default function MultiSelect({ formId, config }: { formId: string; config: MultiSelectWidget }) {
	const { loading, forms, messages, setFormValue } = useNativeLoginContext();
	const formValues = forms[formId] ?? {};
	const selectedValues = (formValues[config.id] as Array<string>) ?? [];
	const value = (forms[formId]?.[config.id] as string) || config.value;
	const disabled = !!loading || !!config.readonly;
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

		const values = (forms[formId]?.[config.id] as Array<string>) || [];
		const optionValue = event.target.value;

		setFormValue(formId, config.id, values.includes(optionValue) ? values.filter((v) => v !== optionValue) : [...values, optionValue]);
	};

	return (
		<div data-widget="multiselect" data-form-id={formId} data-widget-id={config.id}>
			{config.options.map((option) => (
				<div key={option.label} className="item">
					{option.type === 'group' ? (
						<>
							<p>{option.label}</p>
							{option.options.map((subOption) => (
								<div key={subOption.value}>
									<input
										id={subOption.value}
										type="checkbox"
										name={config.id}
										value={subOption.value}
										checked={selectedValues.includes(subOption.value)}
										onChange={onChange}
									/>
									<label htmlFor={subOption.value}>{subOption.label}</label>
								</div>
							))}
						</>
					) : (
						<>
							<input
								id={option.value}
								type="checkbox"
								name={config.id}
								value={option.value}
								checked={selectedValues.includes(option.value)}
								onChange={onChange}
							/>
							<label htmlFor={option.value}>{option.label}</label>
						</>
					)}
				</div>
			))}
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
