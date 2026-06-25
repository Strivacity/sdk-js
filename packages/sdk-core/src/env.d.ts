import type { EmbeddedFlow, LoginComponent } from './types/embedded';

declare global {
	interface StrivacityFramework {
		hostElement?: LoginComponent;
		oidcService?: EmbeddedFlow;
	}

	var sty: StrivacityFramework;
}

export {};
