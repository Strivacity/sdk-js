import { Component, CUSTOM_ELEMENTS_SCHEMA, type OnInit, PLATFORM_ID, computed, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';
import { NativeLoginRendererComponent } from './native-login-renderer';
import { SubmitWidgetComponent, StaticWidgetComponent, PasswordWidgetComponent, CheckboxWidgetComponent } from './widgets';
import { extraParams } from '../';

@Component({
	selector: 'app-native-login',
	templateUrl: './native-login.html',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [NativeLoginRendererComponent, SubmitWidgetComponent, StaticWidgetComponent, PasswordWidgetComponent, CheckboxWidgetComponent],
	providers: [StrivacityNativeLoginService],
})
export class NativeLoginComponent implements OnInit {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);
	readonly router = inject(Router);
	readonly route = inject(ActivatedRoute);
	readonly platformId = inject(PLATFORM_ID);

	readonly flowType = input.required<'login' | 'register'>();

	readonly sessionId = this.route.snapshot.queryParamMap.get('session_id');
	readonly language = this.route.snapshot.queryParamMap.get('language');

	// Each SDK screen is made up of one or more "forms", and each form holds a flat list of
	// "widgets" (inputs/buttons) identified by id. Here we look those widgets up by hand so we
	// can lay them out with fully custom markup instead of using the generic WidgetRenderer below.
	readonly passwordScreen = computed(() => {
		const state = this.nativeLoginService.state();

		if (state.screen !== 'password') {
			return null;
		}

		const passwordForm = state.forms?.find((f) => f.id === 'password');
		const resetForm = state.forms?.find((f) => f.id === 'reset');

		return {
			hasResetForm: !!resetForm,
			sectionTitleWidget: passwordForm?.widgets?.find((w) => w.id === 'section-title'),
			passwordInputWidget: passwordForm?.widgets?.find((w) => w.id === 'password'),
			keepMeLoggedInWidget: passwordForm?.widgets?.find((w) => w.id === 'keepMeLoggedIn'),
			submitWidget: passwordForm?.widgets?.find((w) => w.id === 'submit'),
			resetSubmitWidget: resetForm?.widgets?.find((w) => w.id === 'submit'),
		};
	});

	// useNativeLogin() drives a "headless" auth flow: instead of redirecting to a hosted page,
	// the SDK returns a JSON description of the current screen that this component renders itself.
	// It exposes reactive refs and actions to advance the flow, and fires the callbacks below at key points.
	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		void this.nativeLoginService.start({
			params: {
				...extraParams,
				...(this.flowType() === 'register' ? { prompt: 'create' } : {}),
				// Resume a session started from an entry URL (e.g. a password-reset)
				sessionId: this.sessionId,
				language: this.language,
			},
			onLogin: async () => {
				// You can handle the login event (e.g. to redirect the user to the profile page)
				// Only called when the app runs in client-side mode (sdk.options.serverSessionUri is not set)
				await this.router.navigateByUrl('/profile');
			},
			onClose: () => {
				// You can handle the close event (e.g. to redirect the user to a different page or reload the current page)
				globalThis.location.reload();
			},
			onError: async (error) => {
				// You can handle errors (e.g. to show an error page)
				await this.router.navigate(['/error'], { queryParams: { error: error.message } });
			},
			onFallback: (error) => {
				// Fallback to the hosted journey (e.g. in cases where the native widget or screen is not supported)
				globalThis.location.href = error.url.toString();
			},
			onGlobalMessage: (message) => {
				// You can handle global messages (e.g. to show a toast notification)
				alert(message.text);
			},
		});
	}

	async onPasswordSubmit(event: Event): Promise<void> {
		event.preventDefault();
		await this.nativeLoginService.submitForm('password');
	}
}
