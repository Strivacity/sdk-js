export default function Static(props: { formId: string; config: import('@strivacity/sdk-solid/client').StaticWidget }) {
	if (props.config.render?.type === 'html') {
		// eslint-disable-next-line solid/no-innerhtml
		return <div data-widget="static" data-form-id={props.formId} data-widget-id={props.config.id} innerHTML={props.config.value} />;
	}

	return (
		<div data-widget="static" data-form-id={props.formId} data-widget-id={props.config.id}>
			{props.config.value}
		</div>
	);
}
