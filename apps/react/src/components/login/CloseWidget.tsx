import type { KeyboardEvent, MouseEvent } from 'react';
import type { CloseWidget } from '@strivacity/sdk-react';
import { useNativeLoginContext } from '@strivacity/sdk-react';

export default function Close({ formId, config }: { formId: string; config: CloseWidget }) {
	const { loading, triggerClose } = useNativeLoginContext();
	const disabled = !!loading;

	const onClose = () => {
		if (disabled) {
			return;
		}

		triggerClose();
	};

	const onClick = (event: MouseEvent) => {
		event.preventDefault();
		onClose();
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ' ') {
			onClose();
		}
	};

	if (config.render?.type === 'button') {
		return (
			<button
				disabled={disabled}
				style={{
					backgroundColor: config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? '#5d21ab' : '#ffffff'),
					color: config.render.textColor ?? (config.render.hint?.variant === 'primary' ? '#ffffff' : '#5d21ab'),
				}}
				data-widget="close"
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
		<a data-widget="close" data-type="link" data-form-id={formId} data-widget-id={config.id} tabIndex={0} onClick={onClick} onKeyDown={onKeyDown}>
			{config.label}
		</a>
	);
}
