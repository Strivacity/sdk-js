import type { StaticWidget } from '@strivacity/sdk-core';
import './static.widget.scss';

export function StaticWidget({ formId, config }: { formId: string; config: StaticWidget }) {
	return config.render.type === 'html' ? (
		<div data-widget="static" data-form-id={formId} data-widget-id={config.id} dangerouslySetInnerHTML={{ __html: config.value }} />
	) : (
		<div data-widget="static" data-form-id={formId} data-widget-id={config.id}>
			{config.value}
		</div>
	);
}
