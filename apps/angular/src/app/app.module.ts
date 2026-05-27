import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StrivacityAuthModule, DefaultLogging } from '@strivacity/sdk-angular';
import { routes } from './app.routes';
import { type ImportMeta } from './app.config';

import { AppComponent } from './app.component';
import { CallbackPage } from './pages/callback';
import { HomePage } from './pages/home';
import { LoginPage } from './pages/login';
import { LogoutPage } from './pages/logout';
import { ProfilePage } from './pages/profile';
import { RegisterPage } from './pages/register';
import { RevokePage } from './pages/revoke';
import { EntryPage } from './pages/entry';

import { CheckboxWidget } from './components/widgets/checkbox/checkbox.widget';
import { CloseWidget } from './components/widgets/close/close.widget';
import { DateWidget } from './components/widgets/date/date.widget';
import { InputWidget } from './components/widgets/input/input.widget';
import { LayoutWidget } from './components/widgets/layout/layout.widget';
import { LoadingWidget } from './components/widgets/loading/loading.widget';
import { MultiSelectWidget } from './components/widgets/multiselect/multiselect.widget';
import { PasscodeWidget } from './components/widgets/passcode/passcode.widget';
import { PasskeyEnrollWidget } from './components/widgets/passkey-enroll/passkey-enroll.widget';
import { PasskeyLoginWidget } from './components/widgets/passkey-login/passkey-login.widget';
import { PasswordWidget } from './components/widgets/password/password.widget';
import { PhoneWidget } from './components/widgets/phone/phone.widget';
import { SelectWidget } from './components/widgets/select/select.widget';
import { StaticWidget } from './components/widgets/static/static.widget';
import { SubmitWidget } from './components/widgets/submit/submit.widget';
import { WebAuthnEnrollWidget } from './components/widgets/webauthn-enroll/webauthn-enroll.widget';
import { WebAuthnLoginWidget } from './components/widgets/webauthn-login/webauthn-login.widget';

@NgModule({
	declarations: [
		AppComponent,
		CallbackPage,
		HomePage,
		LoginPage,
		LogoutPage,
		ProfilePage,
		RegisterPage,
		RevokePage,
		EntryPage,
		CheckboxWidget,
		CloseWidget,
		DateWidget,
		InputWidget,
		LayoutWidget,
		LoadingWidget,
		MultiSelectWidget,
		PasscodeWidget,
		PasskeyEnrollWidget,
		PasskeyLoginWidget,
		PasswordWidget,
		PhoneWidget,
		SelectWidget,
		StaticWidget,
		SubmitWidget,
		WebAuthnEnrollWidget,
		WebAuthnLoginWidget,
	],
	imports: [
		BrowserModule,
		CommonModule,
		RouterModule.forRoot(routes),
		StrivacityAuthModule.forRoot({
			mode: (import.meta as unknown as ImportMeta).env.VITE_MODE,
			issuer: (import.meta as unknown as ImportMeta).env.VITE_ISSUER,
			scopes: (import.meta as unknown as ImportMeta).env.VITE_SCOPES.split(' '),
			clientId: (import.meta as unknown as ImportMeta).env.VITE_CLIENT_ID,
			redirectUri: (import.meta as unknown as ImportMeta).env.VITE_REDIRECT_URI,
			storageTokenName: 'sty.session.angular',
			logging: DefaultLogging,
		}),
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	bootstrap: [AppComponent],
})
export class AppModule {}
