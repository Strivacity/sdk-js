---
name: strivacity
description: Use when adding, fixing, or changing how a JavaScript or TypeScript web app signs users in with Strivacity — login, registration, logout, sessions and tokens, protected routes, calling APIs with an access token, hosted / pop-up / embedded login or a fully custom (native, headless) login UI, and server-managed sessions (BFF, http-only cookie sessions, back-channel logout). Also use to request access tokens for APIs (audiences), to choose token storage and refresh behaviour, to debug failing logins and callback errors, and to upgrade from SDK v3 to v4. Covers every @strivacity/sdk-* package: React, Next.js, Vue, Nuxt, Angular, Preact, SolidStart, SvelteKit and plain JavaScript / Node.js (sdk-core). Use whenever a project depends on @strivacity/sdk-*, or the user mentions Strivacity, even if they never say "SDK".
license: MIT
metadata:
  author: Strivacity <opensource@strivacity.com>
  version: '0.2.0'
  sdk-version: '4.x'
  homepage: https://github.com/Strivacity/sdk-js
---

# Strivacity

Detect intent → detect framework → detect mode and session strategy → load 2–3 reference files.

This skill documents **v4** of the Strivacity JS SDKs. v4 is currently published under the npm `next` dist-tag (`4.0.0-beta.x`). If the project already depends on a `@strivacity/sdk-*` 3.x version, tell the user before writing v4 code. Upgrading is its own intent (`upgrade-sdk`).

---

## Step 1: Detect intent

| What the developer wants                                                                                                                                                                                                 | Intent                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Add login / sign-up / logout with Strivacity to an app, protect routes, read the signed-in user, call an API with the access token, or otherwise use a `@strivacity/sdk-*` package                                       | **integrate**              |
| Render the login and registration screens with the app's **own components** instead of a Strivacity-hosted page (forms, widgets, passkeys rendered by the app). _Strivacity: native mode, Journey Flow API._             | **feature:native-login**   |
| Keep tokens out of the browser, store the session in an encrypted http-only cookie, add a backend-for-frontend, make sessions work with SSR, or handle back-channel logout. _Strivacity: Server SDK, BFF._               | **feature:server-session** |
| Get an access token that a specific API accepts: target one or more APIs or audiences. _Strivacity: `audiences` login parameter._                                                                                        | **feature:api-access**     |
| Ask where tokens should be stored, how refresh works, how to react to expiry, revoke vs logout, or "is this secure?"                                                                                                     | **guidance**               |
| Something fails: an error on the callback page, `invalid_request` / `invalid_client`, redirect URI mismatch, a blocked pop-up, state mismatch, the session is lost after reload, refresh fails, a BFF cookie is not sent | **debug**                  |
| Move an app from `@strivacity/sdk-*` 3.x to 4.x, or fix code written for the v3 API                                                                                                                                      | **upgrade-sdk**            |

If the request fits none of these (for example a Strivacity Admin Console question or a non-JavaScript stack), say that this skill does not cover it and point to https://docs.strivacity.com. A request can combine intents (for example native login plus a BFF). Load the union of their files.

---

## Step 2: Detect framework

Read the project's `package.json` (`dependencies` and `devDependencies`). The first row that matches wins, top to bottom. **Order matters**: a Next.js app also depends on `react`, and a Nuxt app also depends on `vue`.

| Project depends on                              | Framework | Package                   | Covered by this skill version |
| ----------------------------------------------- | --------- | ------------------------- | ----------------------------- |
| `next`                                          | `next`    | `@strivacity/sdk-next`    | Yes                           |
| `nuxt`                                          | `nuxt`    | `@strivacity/sdk-nuxt`    | Yes                           |
| `@angular/core`                                 | `angular` | `@strivacity/sdk-angular` | Yes                           |
| `@sveltejs/kit` or `svelte`                     | `svelte`  | `@strivacity/sdk-svelte`  | Yes                           |
| `@solidjs/start` or `solid-js`                  | `solid`   | `@strivacity/sdk-solid`   | Yes                           |
| `preact`                                        | `preact`  | `@strivacity/sdk-preact`  | Yes                           |
| `react`                                         | `react`   | `@strivacity/sdk-react`   | Yes                           |
| `vue`                                           | `vue`     | `@strivacity/sdk-vue`     | Yes                           |
| none of the above, but a browser or Node.js app | `core`    | `@strivacity/sdk-core`    | Yes                           |

- An installed `@strivacity/sdk-<name>` package outranks the table, because the project already chose its wrapper.
- If there is no `package.json` (a new project), use the framework the user names. If they name none, ask.
- A plain Node.js server (Express, Fastify, Hono, …) or a browser app without one of these frameworks is `core`.
- **Not covered** (no row matches and the stack is not JavaScript): say so and point to https://docs.strivacity.com. Never use one framework's reference for another framework.

---

## Step 3: Detect mode and session strategy

**Mode.** If the code already passes a `mode` option to the SDK, keep it. Otherwise pick it from the request:

| The user wants                                                                          | Mode       |
| --------------------------------------------------------------------------------------- | ---------- |
| The standard flow: send the user to the Strivacity-hosted login page and back (default) | `redirect` |
| The hosted login page in a pop-up window, without leaving the current page              | `popup`    |
| The Strivacity login UI embedded inline in one of the app's own pages                   | `embedded` |
| A fully custom login UI built from the app's own components                             | `native`   |

If nothing indicates a mode, use `redirect` and tell the user the other modes exist. Intent `feature:native-login` always means `native`.

**Session strategy.** Set `server-session` to **on** when any of these hold:

- the framework is `next`, `nuxt`, `solid` or `svelte`, or `angular` with SSR (`@angular/ssr`), since these packages manage the session server-side by default;
- the intent is `feature:server-session`;
- the code sets `serverSessionUri` to a string, or the user asks for a BFF, http-only cookie sessions, or tokens kept out of the browser.

Otherwise leave it **off**, which means a client-managed session. If the code explicitly sets `serverSessionUri: false` or `null`, it is **off** even for the frameworks above.

---

## Step 4: Load reference files

Find the section whose heading matches the intent from Step 1, substitute `{framework}` and `{mode}`, and read the listed files. Follow their instructions in order: framework first, then mode, then session.

### integrate

```
Read: references/framework-{framework}/index.md
Read: references/mode-{mode}/index.md
If server-session: Read: references/feature-server-session/index.md
```

### feature:native-login

```
Read: references/framework-{framework}/index.md
Read: references/mode-native/index.md
If server-session: Read: references/feature-server-session/index.md
```

### feature:server-session

```
Read: references/feature-server-session/index.md
If framework covered: Read: references/framework-{framework}/index.md
```

### feature:api-access

```
Read: references/feature-api-access/index.md
If framework covered: Read: references/framework-{framework}/index.md
If server-session: Read: references/feature-server-session/index.md
```

### guidance

```
Read: references/pattern-token-handling/index.md
If framework covered: Read: references/framework-{framework}/index.md
If server-session: Read: references/feature-server-session/index.md
```

### debug

```
Read: references/pattern-common-errors/index.md
If framework covered: Read: references/framework-{framework}/index.md
If mode known: Read: references/mode-{mode}/index.md
```

### upgrade-sdk

```
Read: references/upgrade-v3-to-v4/index.md
If framework covered: Read: references/framework-{framework}/index.md
```

This is an SDK version upgrade, not a new integration. Change only what the upgrade guide lists, and keep the app's existing mode and session strategy.

---

## Ground rules for every intent

- Ask before creating or changing `.env` files. Never read existing `.env` contents into your context without permission.
- Browser code uses a **public** PKCE client. Never put a client secret in browser code. The Server SDK `secret` is only an encryption key for session cookies, and it stays server-side.
- Use the framework wrapper (`@strivacity/sdk-react`, `@strivacity/sdk-vue`, …). Do not import from `@strivacity/sdk-core` directly in a framework app unless the reference says so.
- The `mode` must match the client type in the Strivacity Admin Console. `redirect` and `popup` need **OIDC using no-code components**; `embedded` and `native` need **OIDC using the Journey Flow API**. When login fails right after a mode change, check this first.
- Every redirect URI the app uses must be registered on the client in the Admin Console.
