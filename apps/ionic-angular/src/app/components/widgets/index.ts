import { Type } from '@angular/core';
import { WidgetType } from '@strivacity/sdk-angular';

import { CheckboxWidget } from './checkbox/checkbox.widget';
import { DateWidget } from './date/date.widget';
import { InputWidget } from './input/input.widget';
import { LayoutWidget } from './layout/layout.widget';
import { LoadingWidget } from './loading/loading.widget';
import { MultiSelectWidget } from './multiselect/multiselect.widget';
import { PasscodeWidget } from './passcode/passcode.widget';
import { PasswordWidget } from './password/password.widget';
import { PhoneWidget } from './phone/phone.widget';
import { SelectWidget } from './select/select.widget';
import { StaticWidget } from './static/static.widget';
import { SubmitWidget } from './submit/submit.widget';
import { WebAuthnWidget } from './webauthn/webauthn.widget';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const widgets: Record<WidgetType, Type<any>> = {
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
	webauthn: WebAuthnWidget,
};
