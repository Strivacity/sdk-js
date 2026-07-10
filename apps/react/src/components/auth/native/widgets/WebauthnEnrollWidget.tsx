import type { KeyboardEvent, MouseEvent } from 'react';
import type { WebauthnEnrollWidget } from '@strivacity/sdk-react';
import { createWebAuthnCredential, useNativeLoginContext } from '@strivacity/sdk-react';

export default function WebauthnEnroll({ formId, config }: { formId: string; config: WebauthnEnrollWidget }) {
	const { loading, setFormValue, submitForm } = useNativeLoginContext();
	const disabled = !!loading;

	const onClick = async () => {
		if (disabled) {
			return;
		}

		try {
			const response = await createWebAuthnCredential(config.enrollOptions);
			setFormValue(formId, config.id, response);
			await submitForm(formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Enrollment failed. Please try again.');
		}
	};

	const handleClick = (event: MouseEvent) => {
		event.preventDefault();
		void onClick();
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ' ') {
			void onClick();
		}
	};

	if (config.render?.type === 'button') {
		return (
			<button
				type="button"
				disabled={disabled}
				data-widget="webauthnEnroll"
				data-type="button"
				data-form-id={formId}
				data-widget-id={config.id}
				onClick={handleClick}
				onKeyDown={onKeyDown}
			>
				{config.label}
			</button>
		);
	}

	return (
		<a data-widget="webauthnEnroll" data-type="link" data-form-id={formId} data-widget-id={config.id} tabIndex={0} onClick={handleClick} onKeyDown={onKeyDown}>
			{config.label}
		</a>
	);
}
