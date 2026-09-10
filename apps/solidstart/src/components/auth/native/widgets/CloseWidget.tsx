import type { CloseWidget } from '@strivacity/sdk-solid/client';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function Close(props: { formId: string; config: CloseWidget }) {
	const ctx = useNativeLoginContext();

	function onClose() {
		if (ctx.loading()) {
			return;
		}

		ctx.triggerClose();
	}

	function onClick(event: MouseEvent) {
		event.preventDefault();
		onClose();
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			onClose();
		}
	}

	if (props.config.render?.type === 'button') {
		return (
			<button
				disabled={ctx.loading()}
				style={{
					'background-color': props.config.render.bgColor ?? (props.config.render.hint?.variant === 'primary' ? '#5d21ab' : '#ffffff'),
					color: props.config.render.textColor ?? (props.config.render.hint?.variant === 'primary' ? '#ffffff' : '#5d21ab'),
				}}
				data-widget="close"
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
		<a data-widget="close" data-type="link" data-form-id={props.formId} data-widget-id={props.config.id} tabindex={0} onClick={onClick} onKeyDown={onKeyDown}>
			{props.config.label}
		</a>
	);
}
