import type { KeyboardEvent, MouseEvent, TargetedEvent } from 'preact/compat';
import type { SubmitWidget } from '@strivacity/sdk-preact';
import { useNativeLoginContext } from '@strivacity/sdk-preact';

export default function Submit({ formId, config }: { formId: string; config: SubmitWidget }) {
	const { loading, submitForm } = useNativeLoginContext();
	const disabled = !!loading;

	const onSubmit = async (event: TargetedEvent<HTMLButtonElement | HTMLAnchorElement>) => {
		if (disabled) {
			return;
		}

		const form = event.currentTarget.closest('form');

		if (form?.dataset.formId === formId) {
			form.requestSubmit();
		} else {
			await submitForm(formId);
		}
	};

	const onClick = (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
		event.preventDefault();
		void onSubmit(event);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement | HTMLAnchorElement>) => {
		if (event.key === 'Enter' || event.key === ' ') {
			void onSubmit(event);
		}
	};

	if (config.render?.type === 'button') {
		return (
			<button
				type="submit"
				disabled={disabled}
				style={{
					backgroundColor: config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? '#5d21ab' : '#ffffff'),
					color: config.render.textColor ?? (config.render.hint?.variant === 'primary' ? '#ffffff' : '#5d21ab'),
				}}
				data-widget="submit"
				data-type="button"
				data-form-id={formId}
				data-widget-id={config.id}
				onClick={onClick}
				onKeyDown={onKeyDown}
			>
				{config.label}
			</button>
		);
	}

	return (
		<a data-widget="submit" data-type="link" data-form-id={formId} data-widget-id={config.id} tabIndex={0} onClick={onClick} onKeyDown={onKeyDown}>
			{config.label}
		</a>
	);
}
