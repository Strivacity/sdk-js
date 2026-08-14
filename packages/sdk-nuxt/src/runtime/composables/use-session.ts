import type { SessionData } from '@strivacity/sdk-core/types';
import type { Ref } from '#imports';
import { useState } from '#imports';

/**
 * A composable to access the Strivacity SDK session data.
 *
 * @returns {Ref<SessionData | undefined>} A ref containing the Strivacity SDK session data or undefined if not available.
 */
export const useSession = (): Ref<SessionData | undefined> => useState<SessionData | undefined>('strivacity_session', () => undefined);
