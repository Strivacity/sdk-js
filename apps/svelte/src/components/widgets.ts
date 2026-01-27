import type { Component } from 'svelte';
import type { WidgetType } from '@strivacity/sdk-svelte';

import CheckboxWidget from './checkbox.widget.svelte';
import DateWidget from './date.widget.svelte';
import InputWidget from './input.widget.svelte';
import LayoutWidget from './layout.widget.svelte';
import MultiSelectWidget from './multiselect.widget.svelte';
import LoadingWidget from './loading.widget.svelte';
import PasscodeWidget from './passcode.widget.svelte';
import PasswordWidget from './password.widget.svelte';
import PhoneWidget from './phone.widget.svelte';
import SelectWidget from './select.widget.svelte';
import StaticWidget from './static.widget.svelte';
import SubmitWidget from './submit.widget.svelte';
import CloseWidget from './close.widget.svelte';
import PasskeyLoginWidget from './passkey-login.widget.svelte';
import PasskeyEnrollWidget from './passkey-enroll.widget.svelte';
import WebauthnLoginWidget from './webauthn-login.widget.svelte';
import WebauthnEnrollWidget from './webauthn-enroll.widget.svelte';

export const widgets: Record<WidgetType, Component<unknown>> = {
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
	passkeyLogin: PasskeyLoginWidget,
	passkeyEnroll: PasskeyEnrollWidget,
	webauthnLogin: WebauthnLoginWidget,
	webauthnEnroll: WebauthnEnrollWidget,
};
