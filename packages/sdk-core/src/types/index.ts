import type { EmbeddedFlow, LandingComponent, LanguageSelectorComponent, LoginComponent, NotificationComponent } from './embedded';

declare global {
	interface HTMLElementTagNameMap {
		'sty-language-selector': LanguageSelectorComponent;
		'sty-notifications': NotificationComponent;
		'sty-landing': LandingComponent;
		'sty-login': LoginComponent;
	}

	interface StrivacityFramework {
		hostElement?: LoginComponent;
		oidcService?: EmbeddedFlow;
	}

	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace globalThis {
		// eslint-disable-next-line no-var
		var sty: StrivacityFramework;
	}
}

export * from './common';
export * from './embedded';
export * from './myaccount';
export * from './native';
export * from './oidc';
export * from './popup';
export * from './redirect';
