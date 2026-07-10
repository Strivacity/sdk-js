import type { ComponentType } from 'preact';
import type { WidgetType, LayoutWidget, Widget } from '@strivacity/sdk-preact';
import { useNativeLoginContext } from '@strivacity/sdk-preact';

import Checkbox from './CheckboxWidget';
import Close from './CloseWidget';
import Date from './DateWidget';
import Input from './InputWidget';
import Layout from './LayoutWidget';
import MultiSelect from './MultiSelectWidget';
import Passcode from './PasscodeWidget';
import PasskeyLogin from './PasskeyLoginWidget';
import PasskeyEnroll from './PasskeyEnrollWidget';
import Password from './PasswordWidget';
import Phone from './PhoneWidget';
import Select from './SelectWidget';
import Static from './StaticWidget';
import Submit from './SubmitWidget';
import WebauthnLogin from './WebauthnLoginWidget';
import WebauthnEnroll from './WebauthnEnrollWidget';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const widgets: Record<WidgetType, ComponentType<any>> = {
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

export function WidgetRenderer({ items = [] }: { items?: LayoutWidget['items'] }) {
	const { state, triggerFallback } = useNativeLoginContext();

	return (
		<>
			{items.map((item, index) => {
				if (item.type === 'widget') {
					const form = state.forms?.find((form) => form.id === item.formId);
					const widget = form?.widgets.find((widget) => widget.id === item.widgetId);

					if (!form || !widget) {
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
							<WidgetRenderer items={item.items} />
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
