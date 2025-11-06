import React, { useContext, useMemo } from 'react';
import type { CloseWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-remix';
import './close.widget.scss';

export function CloseWidget({ formId, config }: { formId: string; config: CloseWidget }) {
	const context = useContext(NativeFlowContext);
	const disabled = useMemo(() => !!context?.loading, [context?.loading]);

	const onClose = () => {
		if (disabled) {
			return;
		}

		context?.triggerClose();
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
					data-widget="close"
					data-form-id={formId}
					data-widget-id={config.id}
					onClick={() => onClose()}
					onKeyDown={(e) => (['Enter', 'Space'].includes(e.code) ? onClose() : undefined)}
				>
					{config.label}
				</button>
			) : (
				<a
					data-type="link"
					data-widget="close"
					data-form-id={formId}
					data-widget-id={config.id}
					tabIndex={0}
					onClick={() => onClose()}
					onKeyDown={(e) => (['Enter', 'Space'].includes(e.code) ? onClose() : undefined)}
				>
					{config.label}
				</a>
			)}
		</>
	);
}
