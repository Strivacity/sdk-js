import type { ComponentType } from 'react';
import type { WidgetType } from '@strivacity/sdk-remix';

import { CheckboxWidget } from './checkbox.widget';
import { DateWidget } from './date.widget';
import { InputWidget } from './input.widget';
import { LayoutWidget } from './layout.widget';
import { MultiSelectWidget } from './multiselect.widget';
import { LoadingWidget } from './loading.widget';
import { PasscodeWidget } from './passcode.widget';
import { PasswordWidget } from './password.widget';
import { PhoneWidget } from './phone.widget';
import { SelectWidget } from './select.widget';
import { StaticWidget } from './static.widget';
import { SubmitWidget } from './submit.widget';
import { CloseWidget } from './close.widget';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const widgets: Record<WidgetType, ComponentType<any>> = {
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
