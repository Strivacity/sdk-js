import { type ModuleWithProviders, CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import type { SDKOptions } from '@strivacity/sdk-core';
import { StrivacityAuthService } from './services/auth.service';
import { provideStrivacity } from './utils/helpers';
import { StyLoginRenderer } from './components/login-renderer.component';

@NgModule({
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	providers: [StrivacityAuthService],
	imports: [StyLoginRenderer],
	exports: [StyLoginRenderer],
})
export class StrivacityAuthModule {
	static forRoot(options: SDKOptions): ModuleWithProviders<StrivacityAuthModule> {
		return {
			ngModule: StrivacityAuthModule,
			providers: [provideStrivacity(options)],
		};
	}
}
