import { Session } from '@strivacity/sdk-core/utils/Session';

export type CustomSession = Session & { accessTokenExpired: boolean };
