import React, { useContext, useMemo } from 'react';
import type { SelectWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-next';
import './select.widget.scss';

export function SelectWidget({ formId, config }: { formId: string; config: SelectWidget }) {
	const context = useContext(NativeFlowContext);
	const disabled = useMemo(() => !!context?.loading || !!config.readonly, [context?.loading, config.readonly]);
	const errorMessage = context?.messages[formId]?.[config.id]?.text;
	const value = context?.forms[formId]?.[config.id] as string | undefined;

	const onChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		if (disabled) {
			return;
		}

		context?.setFormValue(formId, config.id, event.target.value);
	};

	if (config.render.type === 'radio') {
		return (
			<div data-widget="select" data-form-id={formId} data-widget-id={config.id}>
				{config.options.map((option) =>
					option.type === 'group' ? (
						<div key={option.label} className="group">
							<p>{option.label}</p>
							{option.options.map((subOption) => (
								<div key={subOption.value} className="item">
									<input
										id={subOption.value}
										type="radio"
										name={config.id}
										readOnly={disabled}
										value={subOption.value}
										checked={subOption.value === value}
										onChange={(e) => onChange(e)}
									/>
									<label htmlFor={subOption.value}>{subOption.label}</label>
								</div>
							))}
						</div>
					) : (
						<div key={option.label} className="item">
							<input id={option.value} type="radio" name={config.id} value={option.value} checked={option.value === value} onChange={onChange} />
							<label htmlFor={option.value}>{option.label}</label>
						</div>
					),
				)}
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
			<select
				id={config.id}
				name={config.id}
				disabled={disabled}
				required={config.validator?.required}
				size={1}
				value={value || ''}
				onChange={(e) => onChange(e)}
			>
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
