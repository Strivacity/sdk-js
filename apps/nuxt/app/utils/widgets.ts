import type { WidgetType } from '@strivacity/sdk-core';
import type { Component } from 'vue';

import CheckboxWidget from '../components/checkbox.widget.vue';
import DateWidget from '../components/date.widget.vue';
import InputWidget from '../components/input.widget.vue';
import LayoutWidget from '../components/layout.widget.vue';
import LoadingWidget from '../components/loading.widget.vue';
import MultiSelectWidget from '../components/multiselect.widget.vue';
import PasscodeWidget from '../components/passcode.widget.vue';
import PasswordWidget from '../components/password.widget.vue';
import PhoneWidget from '../components/phone.widget.vue';
import SelectWidget from '../components/select.widget.vue';
import StaticWidget from '../components/static.widget.vue';
import SubmitWidget from '../components/submit.widget.vue';
import WebauthnWidget from '../components/webauthn.widget.vue';

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
	webauthn: WebauthnWidget,
};
