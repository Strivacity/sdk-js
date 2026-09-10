import type { EmbeddedFlow, LoginComponent } from './types/embedded';

declare global {
	interface StrivacityFramework {
		hostElement?: LoginComponent;
		oidcService?: EmbeddedFlow;
		storage?: Map<string, string>;
	}

	var sty: StrivacityFramework;
}

export {};
