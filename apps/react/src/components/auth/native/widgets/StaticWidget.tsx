import type { StaticWidget } from '@strivacity/sdk-react';

export default function Static({ formId, config }: { formId: string; config: StaticWidget }) {
	if (config.render?.type === 'html') {
		// eslint-disable-next-line react/no-danger
		return <div data-widget="static" data-form-id={formId} data-widget-id={config.id} dangerouslySetInnerHTML={{ __html: config.value }} />;
	}

	return (
		<div data-widget="static" data-form-id={formId} data-widget-id={config.id}>
			{config.value}
		</div>
	);
}
