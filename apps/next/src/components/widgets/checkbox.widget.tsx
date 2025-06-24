import React, { useContext, useMemo } from 'react';
import type { CheckboxWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-next';
import './checkbox.widget.scss';

export function CheckboxWidget({ formId, config }: { formId: string; config: CheckboxWidget }) {
	const context = useContext(NativeFlowContext);
	const value = context?.forms[formId]?.[config.id] ?? config.value;
	const disabled = useMemo(() => !!context?.loading, [context?.loading]);
	const errorMessage = context?.messages[formId]?.[config.id]?.text;
	const validator = config.validator;

	const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled) {
			return;
		}

		context?.setFormValue(formId, config.id, event.target.checked);
	};

	return (
		<div data-widget="checkbox" data-form-id={formId} data-widget-id={config.id}>
			<div>
				<input
					id={config.id}
					name={config.id}
					disabled={config.readonly}
					required={validator?.required}
					type="checkbox"
					size={1}
					checked={!!value}
					onChange={(e) => onChange(e)}
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
