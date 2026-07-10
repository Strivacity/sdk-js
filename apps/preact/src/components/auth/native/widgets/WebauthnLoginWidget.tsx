import type { KeyboardEvent, MouseEvent } from 'preact/compat';
import type { WebauthnLoginWidget } from '@strivacity/sdk-preact';
import { assertWebAuthnCredential, useNativeLoginContext } from '@strivacity/sdk-preact';

export default function WebauthnLogin({ formId, config }: { formId: string; config: WebauthnLoginWidget }) {
	const { loading, setFormValue, submitForm } = useNativeLoginContext();
	const disabled = !!loading;

	const onClick = async () => {
		if (disabled) {
			return;
		}

		try {
			const response = await assertWebAuthnCredential(config.assertionOptions);
			setFormValue(formId, config.id, response);
			await submitForm(formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Authentication failed. Please try again.');
		}
	};

	const handleClick = (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
		event.preventDefault();
		void onClick();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement | HTMLAnchorElement>) => {
		if (event.key === 'Enter' || event.key === ' ') {
			void onClick();
		}
	};

	if (config.render?.type === 'button') {
		return (
			<button
				type="button"
				disabled={disabled}
				data-widget="webauthnLogin"
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
		<a data-widget="webauthnLogin" data-type="link" data-form-id={formId} data-widget-id={config.id} tabIndex={0} onClick={handleClick} onKeyDown={onKeyDown}>
			{config.label}
		</a>
	);
}
