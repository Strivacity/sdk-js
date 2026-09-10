import type { ParentProps } from 'solid-js';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

type LayoutProps = ParentProps<{
	formId?: string;
	type?: string;
	tag?: 'form' | 'div';
}>;

export default function Layout(props: LayoutProps) {
	const ctx = useNativeLoginContext();

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (ctx.loading() || !props.formId) {
			return;
		}

		void ctx.submitForm(props.formId);
	}

	if (props.tag === 'form') {
		return (
			<form data-widget="layout" data-type={props.type} data-form-id={props.formId} onSubmit={onSubmit}>
				{props.children}
			</form>
		);
	}

	return (
		<div data-widget="layout" data-type={props.type} data-form-id={props.formId}>
			{props.children}
		</div>
	);
}
