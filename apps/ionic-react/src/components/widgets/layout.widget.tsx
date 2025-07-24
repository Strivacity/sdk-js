import React, { useContext, useMemo } from 'react';
import type { LayoutWidget } from '@strivacity/sdk-core';
import { NativeFlowContext } from '@strivacity/sdk-react';
import './layout.widget.scss';

export function LayoutWidget({
	formId,
	type,
	tag: Tag = 'div',
	children,
}: {
	formId: string;
	type: LayoutWidget['type'];
	tag?: keyof React.JSX.IntrinsicElements;
	children?: React.ReactNode;
}) {
	const context = useContext(NativeFlowContext);
	const disabled = useMemo(() => !!context?.loading, [context?.loading]);

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (disabled) {
			return;
		}

		await context?.submitForm(formId);
	};

	return (
		<Tag data-widget="layout" data-type={type} data-form-id={formId} onSubmit={(e) => void onSubmit(e)}>
			{children}
		</Tag>
	);
}
