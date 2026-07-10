import type { LayoutWidget, Widget } from '@strivacity/sdk-solid/client';
import { For, untrack } from 'solid-js';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';
import { widgets } from './widgets';

// Recursively renders a screen's layout tree. Each `item` is either:
// - { type: 'widget', formId, widgetId }: a placeholder resolved against the current forms/widgets
// - { type: 'vertical' | 'horizontal', items }: a nested group, rendered inside another layout widget
export function NativeLoginWidgetRenderer(props: { items?: LayoutWidget['items'] }) {
	// useNativeLoginContext() reads the state/actions provided by the useNativeLogin() call
	// that mounted this tree (see NativeLogin.tsx), without needing them passed down as props
	const ctx = useNativeLoginContext();

	return (
		<For each={props.items ?? []}>
			{(item) => {
				if (item.type === 'widget') {
					// The form/widget config is immutable for this item's lifetime - only their values (read reactively inside each widget) change.
					const { form, widget } = untrack(() => {
						const form = ctx.state().forms?.find((form) => form.id === item.formId);

						return { form, widget: form?.widgets.find((widget) => widget.id === item.widgetId) };
					});

					if (!form || !widget) {
						// triggerFallback() bails out to the hosted (non-native) journey when something
						// unexpected happens, e.g. the SDK sent a screen this UI doesn't know how to render
						ctx.triggerFallback(`Unable to find form or widget for item: formId=${item.formId}, widgetId=${item.widgetId}`);

						return null;
					}

					const WidgetComponent = widgets[widget.type];

					if (!WidgetComponent) {
						ctx.triggerFallback(`No component found for widget type ${widget.type}`);

						return null;
					}

					return <WidgetComponent formId={form.id} config={widget} />;
				} else if (item.type === 'vertical' || item.type === 'horizontal') {
					const LayoutComponent = widgets.layout;

					return (
						<LayoutComponent formId={(item.items[0] as Widget).formId} type={item.type}>
							<NativeLoginWidgetRenderer items={item.items} />
						</LayoutComponent>
					);
				}

				ctx.triggerFallback('Unknown item type in layout');

				return null;
			}}
		</For>
	);
}
