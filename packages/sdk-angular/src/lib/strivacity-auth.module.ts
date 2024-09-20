import { type ModuleWithProviders, CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import type { SDKOptions } from '@strivacity/sdk-core';
import { StrivacityAuthService } from './services/auth.service';
import { provideStrivacity } from './utils/helpers';

@NgModule({
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	providers: [StrivacityAuthService],
})
export class StrivacityAuthModule {
	static forRoot(options: SDKOptions): ModuleWithProviders<StrivacityAuthModule> {
		return {
			ngModule: StrivacityAuthModule,
			providers: [provideStrivacity(options)],
		};
	}
}
