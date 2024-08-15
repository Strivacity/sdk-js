export type { SDKOptions, SDKStorage, IdTokenClaims } from '@strivacity/sdk-core';
export type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
export type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
export type { Session } from './lib/utils/types';

export { LocalStorage } from '@strivacity/sdk-core/storages/LocalStorage';
export { SessionStorage } from '@strivacity/sdk-core/storages/SessionStorage';
export { StrivacityAuthService } from './lib/services/auth.service';
export { STRIVACITY_SDK, provideStrivacity } from './lib/utils/helpers';
export { StrivacityAuthModule } from './lib/strivacity-auth.module';
