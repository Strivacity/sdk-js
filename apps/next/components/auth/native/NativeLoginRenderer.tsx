'use client';

import type { LayoutWidget, Widget } from '@strivacity/sdk-next/client';
import { widgets } from './widgets';
import { NativeLoginWidgetRenderer } from './NativeLoginWidgetRenderer';

// NativeLoginWidgetRenderer walks the layout tree and, for each placeholder
// looks up its widget data by id in the current forms and picks the matching React component from the `widgets` map
export default function NativeLoginRenderer({ layout }: { layout?: LayoutWidget }) {
	return (
		<section className="login-renderer">
			<widgets.layout formId={(layout?.items?.[0] as Widget | undefined)?.formId} type={layout?.type} tag="form">
				<NativeLoginWidgetRenderer items={layout?.items} />
			</widgets.layout>
		</section>
	);
}
