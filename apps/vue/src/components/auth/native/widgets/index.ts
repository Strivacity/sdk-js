import type { Component } from 'vue';
import type { WidgetType } from '@strivacity/sdk-vue';

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
