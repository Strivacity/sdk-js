import React, { useContext, useMemo } from 'react';
import type { MultiSelectWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-remix';
import './multiselect.widget.scss';

export function MultiSelectWidget({ formId, config }: { formId: string; config: MultiSelectWidget }) {
	const context = useContext(NativeFlowContext);
	const disabled = useMemo(() => !!context?.loading || !!config.readonly, [context?.loading, config.readonly]);
	const errorMessage = context?.messages[formId]?.[config.id]?.text;
	const values = (context?.forms[formId]?.[config.id] as Array<string>) || [];

	const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		const value = event.target.value;

		context?.setFormValue(formId, config.id, values.includes(value) ? values.filter((v: string) => v !== value) : [...values, value]);
	};

	return (
		<div data-widget="multiselect" data-form-id={formId} data-widget-id={config.id}>
			{config.options.map((option) =>
				option.type === 'group' ? (
					<div key={option.label} className="item">
						<p>{option.label}</p>
						{option.options.map((subOption) => (
							<div key={subOption.value}>
								<input
									id={subOption.value}
									type="checkbox"
									name={config.id}
									value={subOption.value}
									checked={values.includes(subOption.value)}
									onChange={(e) => onChange(e)}
								/>
								<label htmlFor={subOption.value}>{subOption.label}</label>
							</div>
						))}
					</div>
				) : (
					<div key={option.label} className="item">
						<input id={option.value} type="checkbox" name={config.id} value={option.value} checked={values.includes(option.value)} onChange={onChange} />
						<label htmlFor={option.value}>{option.label}</label>
					</div>
				),
			)}
			{errorMessage && <small className="error">{errorMessage}</small>}
		</div>
	);
}
