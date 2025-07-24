export { type SDKOptions, SDKStorage, type IdTokenClaims } from '@strivacity/sdk-core';
export type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
export type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
export type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';

export * from '@strivacity/sdk-core';
export type * from './lib/utils/types';

export { HttpClient } from '@strivacity/sdk-core/utils/HttpClient';
export { LocalStorage } from '@strivacity/sdk-core/storages/LocalStorage';
export { SessionStorage } from '@strivacity/sdk-core/storages/SessionStorage';
export { StyLoginRenderer } from './lib/components/login-renderer.component';
export { StrivacityAuthService } from './lib/services/auth.service';
export { StrivacityWidgetService } from './lib/services/widget.service';
export { STRIVACITY_SDK, provideStrivacity } from './lib/utils/helpers';
export { StrivacityAuthModule } from './lib/strivacity-auth.module';
