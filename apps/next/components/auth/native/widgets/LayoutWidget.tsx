import type { SubmitEvent, ReactNode } from 'react';
import type { LayoutWidget } from '@strivacity/sdk-next/client';
import { useNativeLoginContext } from '@strivacity/sdk-next/client';

type LayoutProps = {
	formId: string;
	type: LayoutWidget['type'];
	tag?: 'div' | 'form';
	children?: ReactNode;
};

export default function Layout({ formId, type, tag = 'div', children }: LayoutProps) {
	const { loading, submitForm } = useNativeLoginContext();
	const disabled = !!loading;

	const onSubmit = (event: SubmitEvent) => {
		event.preventDefault();

		if (disabled) {
			return;
		}

		void submitForm(formId);
	};

	if (tag === 'form') {
		return (
			<form data-widget="layout" data-type={type} data-form-id={formId} onSubmit={onSubmit}>
				{children}
			</form>
		);
	}

	return (
		<div data-widget="layout" data-type={type} data-form-id={formId}>
			{children}
		</div>
	);
}
