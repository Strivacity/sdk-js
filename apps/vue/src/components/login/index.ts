import type { WidgetType, LayoutWidget, Widget } from '@strivacity/sdk-vue';
import type { Component, PropType, VNode } from 'vue';
import { defineComponent, h } from 'vue';
import { useNativeLoginContext } from '@strivacity/sdk-vue';

import Checkbox from './CheckboxWidget.vue';
import Close from './CloseWidget.vue';
import Date from './DateWidget.vue';
import Input from './InputWidget.vue';
import Layout from './LayoutWidget.vue';
import MultiSelect from './MultiSelectWidget.vue';
import Passcode from './PasscodeWidget.vue';
import PasskeyLogin from './PasskeyLoginWidget.vue';
import PasskeyEnroll from './PasskeyEnrollWidget.vue';
import Password from './PasswordWidget.vue';
import Phone from './PhoneWidget.vue';
import Select from './SelectWidget.vue';
import Static from './StaticWidget.vue';
import Submit from './SubmitWidget.vue';
import WebauthnLogin from './WebauthnLoginWidget.vue';
import WebauthnEnroll from './WebauthnEnrollWidget.vue';

export const widgets: Record<WidgetType, Component> = {
	checkbox: Checkbox,
	date: Date,
	input: Input,
	layout: Layout,
	passcode: Passcode,
	password: Password,
	phone: Phone,
	select: Select,
	multiSelect: MultiSelect,
	static: Static,
	submit: Submit,
	close: Close,
	passkeyLogin: PasskeyLogin,
	passkeyEnroll: PasskeyEnroll,
	webauthnLogin: WebauthnLogin,
	webauthnEnroll: WebauthnEnroll,
};

export const WidgetRenderer = defineComponent({
	props: {
		items: {
			type: Array as PropType<LayoutWidget['items']>,
			default: () => [],
		},
	},
	setup: (props) => {
		const { state, triggerFallback } = useNativeLoginContext();

		return () =>
			props.items.map((item): VNode | null => {
				if (item.type === 'widget') {
					const form = state.value?.forms?.find((form) => form.id === item.formId);
					const widget = form?.widgets.find((widget) => widget.id === item.widgetId);

					if (!form || !widget) {
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
						() => h(WidgetRenderer, { items: item.items }),
					);
				} else {
					triggerFallback('Unknown item type in layout');

					return null;
				}
			});
	},
});
