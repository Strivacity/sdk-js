import { useContext, useMemo } from 'react';
import type { PasskeyLoginWidget } from '@strivacity/sdk-core';
import { NativeFlowContext, getCredential } from '@strivacity/sdk-remix';
import './webauthn-login.widget.scss';

export function WebAuthnLoginWidget({ formId, config }: { formId: string; config: PasskeyLoginWidget }) {
	const context = useContext(NativeFlowContext);
	const disabled = useMemo(() => !!context?.loading, [context?.loading]);

	const onClick = async () => {
		if (!context || disabled) {
			return;
		}

		try {
			const response = await getCredential(config.assertionOptions);
			context.setFormValue(formId, config.id, response);
			await context.submitForm(formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Authentication failed. Please try again.');
		}
	};

	return (
		<>
			{config.render.type === 'button' ? (
				<button
					type="button"
					disabled={disabled}
					data-widget="webauthnLogin"
					data-type="button"
					data-form-id={formId}
					data-widget-id={config.id}
					onClick={(e) => {
						e.preventDefault();
						void onClick();
					}}
					onKeyDown={(e) => (['Enter', 'Space'].includes(e.code) ? (e.preventDefault(), void onClick()) : undefined)}
				>
					{config.label}
				</button>
			) : (
				<a
					data-widget="webauthnLogin"
					data-type="link"
					data-form-id={formId}
					data-widget-id={config.id}
					tabIndex={0}
					onClick={(e) => {
						e.preventDefault();
						void onClick();
					}}
					onKeyDown={(e) => (['Enter', 'Space'].includes(e.code) ? (e.preventDefault(), void onClick()) : undefined)}
				>
					{config.label}
				</a>
			)}
		</>
	);
}
