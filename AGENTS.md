# AGENTS.md

Guidance for AI coding agents working in this repository. Human-facing docs live in [README.md](./README.md), [CONTRIBUTING.md](./CONTRIBUTING.md) and [apps/README.md](./apps/README.md).

## What this repo is

The Strivacity JavaScript SDKs: a pnpm + Nx monorepo that publishes `@strivacity/sdk-*` packages for OIDC (PKCE) authentication against Strivacity, plus one example app per framework.

`@strivacity/sdk-core` holds all protocol logic. Every framework package is a thin wrapper that re-exports `@strivacity/sdk-core/{flows,handlers,utils}` and adds framework bindings. **Fix bugs and add features in core first**, then expose them in the wrappers.

## Layout

| Path                     | What it is                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/sdk-core`      | Framework-agnostic SDK. Entry: `initFlow()` in `src/index.ts`                                                                                                                                                                                                       |
| `packages/sdk-core/src/` | `flows/` (redirect, popup, embedded, native), `handlers/`, `storages/`, `server/` (Server SDK / BFF), `types/`, `utils/`                                                                                                                                            |
| `packages/sdk-react`     | `StyAuthProvider`, `useStrivacity`, `useNativeLogin`, `withAuthGuard`                                                                                                                                                                                               |
| `packages/sdk-preact`    | Same API as sdk-react                                                                                                                                                                                                                                               |
| `packages/sdk-vue`       | `createStrivacitySDK` plugin, `useStrivacity`, `useNativeLogin`                                                                                                                                                                                                     |
| `packages/sdk-angular`   | `provideStrivacity`, `StrivacityAuthService`, `StrivacityNativeLoginService`; `./server` for Express SSR                                                                                                                                                            |
| `packages/sdk-next`      | `./client` re-exports sdk-react; `./server` has `createServerSDK` and route handler factories (**no root export**)                                                                                                                                                  |
| `packages/sdk-nuxt`      | Nuxt module (`src/module.ts`); auto-imported composables; registers Nitro routes under `authUriPrefix` when server sessions are on. The SDK instance is browser-only (client plugin); during SSR `useStrivacity()` is a read-only context built from `useSession()` |
| `packages/sdk-solid`     | `./client` and `./server` only (**no root export**)                                                                                                                                                                                                                 |
| `packages/sdk-svelte`    | `./client` (`createStyAuthProvider`, `*.svelte.ts`) and `./server` only (**no root export**)                                                                                                                                                                        |
| `tools/common`           | Shared helpers for the example apps (`utils/oidc.ts` → `getExtraParams` maps env vars to `ExtraRequestArgs`)                                                                                                                                                        |
| `tools/testing`          | Shared Vitest config/setup, msw mocks, OIDC fixtures (`@strivacity/testing`)                                                                                                                                                                                        |
| `apps/*`                 | Example apps (Nx project names `app-*`); `apps/backend` is an Express BFF the SPA apps can pair with                                                                                                                                                                |
| `plugins/strivacity`     | Agent skill for SDK users (router `skills/strivacity/SKILL.md` + `references/`), with Claude Code / Cursor / Codex manifests                                                                                                                                        |
| `evals/skill`            | Structure and routing checks for the agent skill (`pnpm skill:check`)                                                                                                                                                                                               |

Tests live in `packages/<pkg>/testing/tests/**/*.spec.ts(x)`, not next to sources.

## Commands

Run from the repo root. Requires Node 24+ (`.nvmrc`) and pnpm 12 (`packageManager` in `package.json`).

```bash
pnpm install
pnpm build                       # builds all sdk-* packages
pnpm test:ci                     # all tests with coverage (what CI runs)
pnpm lint                        # eslint for every project
pnpm sdk:<fw>:build              # fw = core|react|preact|vue|angular|next|nuxt|solid|svelte
pnpm sdk:<fw>:test
cd packages/sdk-core && npx vitest run testing/tests/utils/oidc.spec.ts   # single file
```

- Test targets run bare `vitest`, which enters **watch mode in an interactive TTY**. Prefer `pnpm test:ci`, `nx run sdk-<fw>:test` in a non-TTY shell, or `npx vitest run …`.
- Target chain: `test` → `build` → `type-check` (`tsc --noEmit`). Wrapper packages build against `sdk-core/dist`, so **rebuild core** (`pnpm sdk:core:build`) after changing it before testing a wrapper.
- CI (`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm skill:check`, then `pnpm test:ci` on pull requests.

## Conventions

- **Formatting:** Prettier (`prettier.config.js`): tabs, single quotes, semicolons, trailing commas, 160 columns. A pre-commit hook runs Prettier on staged files.
- **Commits:** Conventional Commits, enforced by commitlint (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- **Releases:** `nx release` handles versions and `CHANGELOG.md` files. Do not bump versions or edit CHANGELOGs by hand. Publishing happens in `.github/workflows/publish.yml` on push to `main`.
- **Public API docs:** JSDoc on exported types is user-facing. Keep `@default` values in sync with the actual defaults in `packages/sdk-core/src/utils/oidc.ts` (client) and `src/utils/server.ts` (server).
- **Package READMEs** (`packages/*/README.md`) are the user documentation, and every package documents the shared options. A change to a shared option usually means touching all 9 READMEs.
- **Agent skill** (`plugins/strivacity/skills/strivacity/references/`) teaches coding agents how to use the SDK, with code samples. When a public API, default or behaviour changes, update the matching `framework-*`, `mode-*`, `feature-*` or `pattern-*` reference in the same change. Reference files must not link to other `.md` files; run `pnpm skill:check` after editing `SKILL.md` or adding a reference.

## Checklist: adding an SDK option or login parameter

Follow how the `audiences` login parameter is wired through as the reference:

1. Type with JSDoc: `SDKOptions` or `ExtraRequestArgs` in `packages/sdk-core/src/types/oidc.ts`. Server-only options go in `ServerSDKOptions` in `src/types/server.ts`.
2. Default value: `src/utils/oidc.ts` (`defaultOptions`) or `src/utils/server.ts`.
3. Behaviour: usually `src/utils/oidc.ts` (authorize URL / token requests). Also `src/server/base.ts` if the BFF must forward it from query params.
4. Tests in `packages/sdk-core/testing/tests/` (`utils/oidc.spec.ts`, `flows/*.spec.ts`, `server/base.spec.ts`).
5. Docs in all 9 `packages/*/README.md`.
6. Example apps, if they configure it from env: `.env.local.example`, `tools/common/utils/oidc.ts`, `apps/next/next.config.ts`, `apps/nuxt/nuxt.config.ts`, `apps/angular/src/env.d.ts`.
7. Agent skill: the options table in each `plugins/strivacity/skills/strivacity/references/framework-*/index.md` (and `feature-*` if the option belongs to a feature).

## Concepts that are easy to get wrong

- **`mode`** selects the flow: `redirect` and `popup` use the hosted login page. `embedded` mounts the `<sty-login>` web component. `native` is headless: the app renders `forms` and `widgets` returned by the IdP via `useNativeLogin` / `StrivacityNativeLoginService`. `embedded` and `native` require a "Journey Flow API" client in the Strivacity Admin Console.
- **`serverSessionUri`** (`boolean | string | null`) switches between client-managed and server-managed sessions:
  - `null`, `false` or unset: tokens live in client storage.
  - a string: login goes through that BFF endpoint, and tokens stay server-side in encrypted http-only cookies.
  - `true`: server-managed without routing through a BFF endpoint.

  The client default is `null`; the Server SDK (`createServerSDK`) defaults it to `` `${authUriPrefix}/login` ``.

- **Server SDK routes** (`src/server/base.ts`): `GET {authUriPrefix}/{login,register,callback,refresh,revoke,entry,logout}` and `POST {authUriPrefix}/backchannel-logout`.
- **Naming differs per framework:** provider/plugin is `StyAuthProvider` (React, Preact, Solid, Next), `createStyAuthProvider` (Svelte), `createStrivacitySDK` (Vue) or `provideStrivacity` (Angular). Angular uses services instead of `use*` hooks.

## Example apps

- Config comes from the repo-root `.env.local` (template: `.env.local.example`; variables are listed in the root README). Next and Nuxt re-expose them without the `VITE_` prefix.
- Run with `pnpm app:<name>:serve`, or `pnpm app:<vue|react|preact>-backend:serve` to pair an SPA with the BFF (also set `VITE_SERVER_SESSION_URI="/auth/login"`).
- Every app demos all four modes side by side. Keep the apps structurally identical when changing one.

## Do not

- Read or print `.env.local`. It holds real tenant credentials.
- Search inside generated or local-only folders: `.history/` (editor history), `dist/`, `coverages/`, `reports/`, `.nx/`, `.angular/`, `.nuxt/`, `.next/`, `.svelte-kit/`, `.output/`, `node_modules/`.
- Commit debugging overrides in example apps (e.g. forcing `serverSessionUri: false` or a different storage).
