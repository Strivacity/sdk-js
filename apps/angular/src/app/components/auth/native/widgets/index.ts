import type { Type } from '@angular/core';
import type { WidgetType } from '@strivacity/sdk-angular';

import { CheckboxWidgetComponent } from './checkbox-widget';
import { CloseWidgetComponent } from './close-widget';
import { DateWidgetComponent } from './date-widget';
import { InputWidgetComponent } from './input-widget';
import { LayoutWidgetComponent } from './layout-widget';
import { MultiSelectWidgetComponent } from './multi-select-widget';
import { PasscodeWidgetComponent } from './passcode-widget';
import { PasskeyEnrollWidgetComponent } from './passkey-enroll-widget';
import { PasskeyLoginWidgetComponent } from './passkey-login-widget';
import { PasswordWidgetComponent } from './password-widget';
import { PhoneWidgetComponent } from './phone-widget';
import { SelectWidgetComponent } from './select-widget';
import { StaticWidgetComponent } from './static-widget';
import { SubmitWidgetComponent } from './submit-widget';
import { WebauthnEnrollWidgetComponent } from './webauthn-enroll-widget';
import { WebauthnLoginWidgetComponent } from './webauthn-login-widget';

export * from './checkbox-widget';
export * from './close-widget';
export * from './date-widget';
export * from './input-widget';
export * from './layout-widget';
export * from './multi-select-widget';
export * from './passcode-widget';
export * from './passkey-enroll-widget';
export * from './passkey-login-widget';
export * from './password-widget';
export * from './phone-widget';
export * from './select-widget';
export * from './static-widget';
export * from './submit-widget';
export * from './webauthn-enroll-widget';
export * from './webauthn-login-widget';

export const widgets: Record<WidgetType, Type<unknown>> = {
	checkbox: CheckboxWidgetComponent,
	date: DateWidgetComponent,
	input: InputWidgetComponent,
	layout: LayoutWidgetComponent,
	passcode: PasscodeWidgetComponent,
	password: PasswordWidgetComponent,
	phone: PhoneWidgetComponent,
	select: SelectWidgetComponent,
	multiSelect: MultiSelectWidgetComponent,
	static: StaticWidgetComponent,
	submit: SubmitWidgetComponent,
	close: CloseWidgetComponent,
	passkeyLogin: PasskeyLoginWidgetComponent,
	passkeyEnroll: PasskeyEnrollWidgetComponent,
	webauthnLogin: WebauthnLoginWidgetComponent,
	webauthnEnroll: WebauthnEnrollWidgetComponent,
};
