import type { ChangeEvent } from 'preact/compat';
import type { MultiSelectWidget } from '@strivacity/sdk-preact';
import { useEffect, useRef } from 'preact/compat';
import { useNativeLoginContext } from '@strivacity/sdk-preact';

export default function MultiSelect({ formId, config }: { formId: string; config: MultiSelectWidget }) {
	const { loading, forms, messages, setFormValue } = useNativeLoginContext();
	const container = useRef<HTMLDivElement>(null);
	const selectedValues = (forms[formId]?.[config.id] as Array<string> | undefined) ?? [];
	const disabled = !!loading || !!config.readonly;
	const errorMessage = messages[formId]?.[config.id]?.text;
	const minSelectable = config.validator?.minSelectable ?? 0;
	const maxSelectable = config.validator?.maxSelectable ?? Infinity;

	useEffect(() => {
		const value = (forms[formId]?.[config.id] as Array<string> | undefined) ?? config.value;

		if (value) {
			setFormValue(formId, config.id, value);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const message = selectedValues.length < minSelectable ? `Select at least ${minSelectable} option(s).` : '';
		container.current?.querySelector('input')?.setCustomValidity(message);
	}, [selectedValues.length, minSelectable]);

	const isDisabled = (value: string) => disabled || (!selectedValues.includes(value) && selectedValues.length >= maxSelectable);

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		const optionValue = event.currentTarget.value;

		if (isDisabled(optionValue)) {
			return;
		}

		setFormValue(formId, config.id, selectedValues.includes(optionValue) ? selectedValues.filter((v) => v !== optionValue) : [...selectedValues, optionValue]);
	};

	return (
		<div ref={container} data-widget="multiselect" data-form-id={formId} data-widget-id={config.id}>
			{config.options.map((option) => (
				<div key={option.label} className="item">
					{option.type === 'group' ? (
						<>
							<p>{option.label}</p>
							{option.options.map((subOption) => (
								<div key={subOption.value}>
									<input
										id={`${config.id}-${subOption.value}`}
										type="checkbox"
										name={config.id}
										value={subOption.value}
										disabled={isDisabled(subOption.value)}
										checked={selectedValues.includes(subOption.value)}
										onChange={onChange}
									/>
									<label htmlFor={`${config.id}-${subOption.value}`}>{subOption.label}</label>
								</div>
							))}
						</>
					) : (
						<>
							<input
								id={`${config.id}-${option.value}`}
								type="checkbox"
								name={config.id}
								value={option.value}
								disabled={isDisabled(option.value)}
								checked={selectedValues.includes(option.value)}
								onChange={onChange}
							/>
							<label htmlFor={`${config.id}-${option.value}`}>{option.label}</label>
						</>
					)}
				</div>
			))}
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
