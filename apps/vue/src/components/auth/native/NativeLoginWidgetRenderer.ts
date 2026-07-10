import type { LayoutWidget, Widget } from '@strivacity/sdk-vue';
import type { PropType, VNode } from 'vue';
import { defineComponent, h } from 'vue';
import { useNativeLoginContext } from '@strivacity/sdk-vue';
import { widgets } from './widgets';

// Recursively renders a screen's layout tree. Each `item` is either:
// - { type: 'widget', formId, widgetId }: a placeholder resolved against the current forms/widgets
// - { type: 'vertical' | 'horizontal', items }: a nested group, rendered inside another layout widget
export const NativeLoginWidgetRenderer = defineComponent({
	props: {
		items: {
			type: Array as PropType<LayoutWidget['items']>,
			default: () => [],
		},
	},
	setup: (props) => {
		// useNativeLoginContext() reads the state/actions provided by the useNativeLogin() call
		// that mounted this tree (see NativeLogin.vue), without needing them passed down as props
		const { state, triggerFallback } = useNativeLoginContext();

		return () =>
			props.items.map((item): VNode | null => {
				if (item.type === 'widget') {
					const form = state.value?.forms?.find((form) => form.id === item.formId);
					const widget = form?.widgets.find((widget) => widget.id === item.widgetId);

					if (!form || !widget) {
						// triggerFallback() bails out to the hosted (non-native) journey when something
						// unexpected happens, e.g. the SDK sent a screen this UI doesn't know how to render
						triggerFallback(`Unable to find form or widget for item: formId=${item.formId}, widgetId=${item.widgetId}`);

						return null;
					}

					const component = widgets[widget.type];

					if (!component) {
						triggerFallback(`No component found for widget type ${widget.type}`);

						return null;
					}

					return h(component, {
						key: `${form.id}.${widget.id}`,
						formId: form.id,
						config: widget,
					});
				} else if (item.type === 'vertical' || item.type === 'horizontal') {
					if (!widgets.layout) {
						triggerFallback('No layout component provided');

						return null;
					}

					return h(
						widgets.layout,
						{
							formId: (item.items[0] as Widget).formId,
							type: item.type,
						},
						() => h(NativeLoginWidgetRenderer, { items: item.items }),
					);
				} else {
					triggerFallback('Unknown item type in layout');

					return null;
				}
			});
	},
});
