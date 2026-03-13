/* eslint-disable @typescript-eslint/no-explicit-any */

import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { SDKOptions, FallbackError, StyLoginRenderer, LoginFlowState, type ExtraRequestArgs, StrivacityAuthService } from '@strivacity/sdk-angular';
import { type ImportMeta } from '../../app.config';
import { widgets } from '../../components/widgets';

@Component({
	standalone: true,
	imports: [StyLoginRenderer],
	selector: 'app-login-page',
	templateUrl: './login.page.html',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPage {
	readonly widgets = widgets;
	shortAppId: string | null = null;
	sessionId: string | null = null;
	mode: SDKOptions['mode'] = 'embedded';
	extraParams: ExtraRequestArgs = {
		loginHint: (import.meta as unknown as ImportMeta).env.VITE_LOGIN_HINT,
		acrValues: (import.meta as unknown as ImportMeta).env.VITE_ACR_VALUES ? (import.meta as unknown as ImportMeta).env.VITE_ACR_VALUES.split(' ') : undefined,
		uiLocales: (import.meta as unknown as ImportMeta).env.VITE_UI_LOCALES ? (import.meta as unknown as ImportMeta).env.VITE_UI_LOCALES.split(' ') : undefined,
		audiences: (import.meta as unknown as ImportMeta).env.VITE_AUDIENCES ? (import.meta as unknown as ImportMeta).env.VITE_AUDIENCES.split(' ') : undefined,
	};

	constructor(
		protected router: Router,
		protected strivacityAuthService: StrivacityAuthService,
	) {
		this.mode = (import.meta as unknown as ImportMeta).env.VITE_MODE;

		if (window.location.search !== '') {
			const url = new URL(window.location.href);
			this.sessionId = url.searchParams.get('session_id');
			url.search = '';
			history.replaceState({}, '', url.toString());
		}
	}

	onLogin() {
		void this.router.navigateByUrl('/profile');
	}

	onFallback(error: FallbackError) {
		if (error.url) {
			location.href = error.url.toString();
		} else {
			alert(error);
		}
	}

	onClose() {
		location.reload();
	}

	onError(error: any) {
		alert(error);
	}

	onGlobalMessage(message: string) {
		alert(message);
	}

	onBlockReady(_events: { previousState: LoginFlowState; state: LoginFlowState }) {
		// You can handle block ready events here
	}
}
