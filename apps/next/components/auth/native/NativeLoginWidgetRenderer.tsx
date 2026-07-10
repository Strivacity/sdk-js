'use client';

import type { LayoutWidget, Widget } from '@strivacity/sdk-next/client';
import { useNativeLoginContext } from '@strivacity/sdk-next/client';
import { widgets } from './widgets';

// Recursively renders a screen's layout tree. Each `item` is either:
// - { type: 'widget', formId, widgetId }: a placeholder resolved against the current forms/widgets
// - { type: 'vertical' | 'horizontal', items }: a nested group, rendered inside another layout widget
export function NativeLoginWidgetRenderer({ items = [] }: { items?: LayoutWidget['items'] }) {
	// useNativeLoginContext() reads the state/actions provided by the useNativeLogin() call
	// that mounted this tree (see NativeLogin.tsx), without needing them passed down as props
	const { state, triggerFallback } = useNativeLoginContext();

	return (
		<>
			{items.map((item, index) => {
				if (item.type === 'widget') {
					const form = state.forms?.find((form) => form.id === item.formId);
					const widget = form?.widgets.find((widget) => widget.id === item.widgetId);

					if (!form || !widget) {
						// triggerFallback() bails out to the hosted (non-native) journey when something
						// unexpected happens, e.g. the SDK sent a screen this UI doesn't know how to render
						triggerFallback(`Unable to find form or widget for item: formId=${item.formId}, widgetId=${item.widgetId}`);

						return null;
					}

					const WidgetComponent = widgets[widget.type];

					if (!WidgetComponent) {
						triggerFallback(`No component found for widget type ${widget.type}`);

						return null;
					}

					return <WidgetComponent key={`${form.id}.${widget.id}`} formId={form.id} config={widget} />;
				} else if (item.type === 'vertical' || item.type === 'horizontal') {
					const LayoutComponent = widgets.layout;

					if (!LayoutComponent) {
						triggerFallback('No layout component provided');

						return null;
					}

					return (
						<LayoutComponent key={index} formId={(item.items[0] as Widget).formId} type={item.type}>
							<NativeLoginWidgetRenderer items={item.items} />
						</LayoutComponent>
					);
				} else {
					triggerFallback('Unknown item type in layout');

					return null;
				}
			})}
		</>
	);
}
