import React, { useContext, useMemo } from 'react';
import type { SubmitWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-react';
import './submit.widget.scss';

export function SubmitWidget({ formId, config }: { formId: string; config: SubmitWidget }) {
	const context = useContext(NativeFlowContext);
	const disabled = useMemo(() => !!context?.loading, [context?.loading]);

	const onSubmit = async (event: React.SyntheticEvent) => {
		event.preventDefault();

		if (disabled) {
			return;
		}

		const form = (event.target as HTMLElement).closest('form');

		if (form?.dataset.formId === formId) {
			form.requestSubmit();
		} else {
			await context?.submitForm(formId);
		}
	};

	return (
		<>
			{config.render.type === 'button' ? (
				<button
					disabled={disabled}
					style={{
						backgroundColor: config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? `#5d21ab` : `#ffffff`),
						color: config.render.textColor ?? (config.render.hint?.variant === 'primary' ? `#ffffff` : `#5d21ab`),
					}}
					data-type="button"
					data-widget="submit"
					data-form-id={formId}
					data-widget-id={config.id}
					onClick={(e) => void onSubmit(e)}
					onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? void onSubmit(e) : undefined)}
				>
					{config.label}
				</button>
			) : (
				<a
					data-type="link"
					data-widget="submit"
					data-form-id={formId}
					data-widget-id={config.id}
					tabIndex={0}
					onClick={(e) => void onSubmit(e)}
					onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? void onSubmit(e) : undefined)}
				>
					{config.label}
				</a>
			)}
		</>
	);
}
