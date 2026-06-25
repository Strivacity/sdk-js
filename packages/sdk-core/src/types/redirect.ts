import type { ExtraRequestArgs, RedirectOptions, SDK } from './oidc';

export type RedirectParams = ExtraRequestArgs & RedirectOptions;

export type RedirectFlow = SDK<RedirectParams>;
