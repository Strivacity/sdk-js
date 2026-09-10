import type { SubmitWidget } from '@strivacity/sdk-solid/client';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function Submit(props: { formId: string; config: SubmitWidget }) {
	const ctx = useNativeLoginContext();

	async function onSubmit(event: MouseEvent | KeyboardEvent) {
		if (ctx.loading()) {
			return;
		}

		const target = event.currentTarget as HTMLButtonElement | HTMLAnchorElement;
		const form = target.closest('form');

		if (form?.dataset.formId === props.formId) {
			form.requestSubmit();
		} else {
			await ctx.submitForm(props.formId);
		}
	}

	function onClick(event: MouseEvent) {
		event.preventDefault();
		void onSubmit(event);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			void onSubmit(event);
		}
	}

	if (props.config.render?.type === 'button') {
		return (
			<button
				type="submit"
				disabled={ctx.loading()}
				style={{
					'background-color': props.config.render.bgColor ?? (props.config.render.hint?.variant === 'primary' ? '#5d21ab' : '#ffffff'),
					color: props.config.render.textColor ?? (props.config.render.hint?.variant === 'primary' ? '#ffffff' : '#5d21ab'),
				}}
				data-widget="submit"
				data-type="button"
				data-form-id={props.formId}
				data-widget-id={props.config.id}
				onClick={onClick}
				onKeyDown={onKeyDown}
			>
				{props.config.label}
			</button>
		);
	}

	return (
		<a data-widget="submit" data-type="link" data-form-id={props.formId} data-widget-id={props.config.id} tabindex={0} onClick={onClick} onKeyDown={onKeyDown}>
			{props.config.label}
		</a>
	);
}
