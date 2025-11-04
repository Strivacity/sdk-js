import { type Component } from 'vue';
import type { WidgetType } from '@strivacity/sdk-core';

import CheckboxWidget from './checkbox.widget.vue';
import DateWidget from './date.widget.vue';
import InputWidget from './input.widget.vue';
import LayoutWidget from './layout.widget.vue';
import MultiSelectWidget from './multiselect.widget.vue';
import LoadingWidget from './loading.widget.vue';
import PasscodeWidget from './passcode.widget.vue';
import PasswordWidget from './password.widget.vue';
import PhoneWidget from './phone.widget.vue';
import SelectWidget from './select.widget.vue';
import StaticWidget from './static.widget.vue';
import SubmitWidget from './submit.widget.vue';
import CloseWidget from './close.widget.vue';

export const widgets: Record<WidgetType, Component> = {
	checkbox: CheckboxWidget,
	date: DateWidget,
	input: InputWidget,
	layout: LayoutWidget,
	loading: LoadingWidget,
	passcode: PasscodeWidget,
	password: PasswordWidget,
	phone: PhoneWidget,
	select: SelectWidget,
	multiSelect: MultiSelectWidget,
	static: StaticWidget,
	submit: SubmitWidget,
	close: CloseWidget,
};
