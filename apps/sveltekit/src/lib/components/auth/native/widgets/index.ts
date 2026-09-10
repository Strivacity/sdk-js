import type { WidgetType } from '@strivacity/sdk-svelte/client';
import type { Component } from 'svelte';

import CheckboxWidget from './CheckboxWidget.svelte';
import CloseWidget from './CloseWidget.svelte';
import DateWidget from './DateWidget.svelte';
import InputWidget from './InputWidget.svelte';
import LayoutWidget from './LayoutWidget.svelte';
import MultiSelectWidget from './MultiSelectWidget.svelte';
import PasscodeWidget from './PasscodeWidget.svelte';
import PasskeyEnrollWidget from './PasskeyEnrollWidget.svelte';
import PasskeyLoginWidget from './PasskeyLoginWidget.svelte';
import PasswordWidget from './PasswordWidget.svelte';
import PhoneWidget from './PhoneWidget.svelte';
import SelectWidget from './SelectWidget.svelte';
import StaticWidget from './StaticWidget.svelte';
import SubmitWidget from './SubmitWidget.svelte';
import WebauthnEnrollWidget from './WebauthnEnrollWidget.svelte';
import WebauthnLoginWidget from './WebauthnLoginWidget.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const widgets: Record<WidgetType, Component<any>> = {
	checkbox: CheckboxWidget,
	date: DateWidget,
	input: InputWidget,
	layout: LayoutWidget,
	passcode: PasscodeWidget,
	password: PasswordWidget,
	phone: PhoneWidget,
	select: SelectWidget,
	multiSelect: MultiSelectWidget,
	static: StaticWidget,
	submit: SubmitWidget,
	close: CloseWidget,
	passkeyLogin: PasskeyLoginWidget,
	passkeyEnroll: PasskeyEnrollWidget,
	webauthnLogin: WebauthnLoginWidget,
	webauthnEnroll: WebauthnEnrollWidget,
};
