import type { WebauthnEnrollWidget } from '@strivacity/sdk-solid/client';
import { createWebAuthnCredential, useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function WebauthnEnroll(props: { formId: string; config: WebauthnEnrollWidget }) {
	const ctx = useNativeLoginContext();

	async function onClick() {
		if (ctx.loading()) {
			return;
		}

		try {
			const response = await createWebAuthnCredential(props.config.enrollOptions);
			ctx.setFormValue(props.formId, props.config.id, response);
			await ctx.submitForm(props.formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Enrollment failed. Please try again.');
		}
	}

	function handleClick(event: MouseEvent) {
		event.preventDefault();
		void onClick();
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			void onClick();
		}
	}

	if (props.config.render?.type === 'button') {
		return (
			<button
				type="button"
				disabled={ctx.loading()}
				data-widget="webauthnEnroll"
				data-type="button"
				data-form-id={props.formId}
				data-widget-id={props.config.id}
				onClick={handleClick}
				onKeyDown={onKeyDown}
			>
				{props.config.label}
			</button>
		);
	}

	return (
		<a
			data-widget="webauthnEnroll"
			data-type="link"
			data-form-id={props.formId}
			data-widget-id={props.config.id}
			tabindex={0}
			onClick={handleClick}
			onKeyDown={onKeyDown}
		>
			{props.config.label}
		</a>
	);
}
