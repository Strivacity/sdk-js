import type { Component } from 'solid-js';
import type { WidgetType } from '@strivacity/sdk-solid/client';

import Checkbox from './CheckboxWidget';
import Close from './CloseWidget';
import DateField from './DateWidget';
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
export const widgets: Record<WidgetType, Component<any>> = {
	checkbox: Checkbox,
	date: DateField,
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
