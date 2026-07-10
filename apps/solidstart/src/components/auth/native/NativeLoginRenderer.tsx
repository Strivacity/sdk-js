import type { LayoutWidget, Widget } from '@strivacity/sdk-solid/client';
import { widgets } from './widgets';
import { NativeLoginWidgetRenderer } from './NativeLoginWidgetRenderer';

// NativeLoginWidgetRenderer walks the layout tree and, for each placeholder
// looks up its widget data by id in the current forms and picks the matching Solid component from the `widgets` map
export default function NativeLoginRenderer(props: { layout?: LayoutWidget }) {
	return (
		<section class="login-renderer">
			<widgets.layout formId={(props.layout?.items?.[0] as Widget | undefined)?.formId} type={props.layout?.type} tag="form">
				<NativeLoginWidgetRenderer items={props.layout?.items} />
			</widgets.layout>
		</section>
	);
}
