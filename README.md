![JavaScript SDK](https://static.strivacity.com/images/javascript-sdk.png)

# Strivacity JavaScript SDK

This repository contains the Strivacity JavaScript SDK - a collection of framework-specific packages and example applications for integrating Strivacity's policy-driven authentication journeys into JavaScript and TypeScript applications.

The SDK uses the OAuth 2.0 PKCE flow and supports `redirect`, `popup`, `native`, and `embedded` modes.

---

## Repository structure

This is a pnpm monorepo. It contains:

- **`packages/`** - Publishable SDK packages
- **`apps/`** - Example applications for each framework
- **`tools/`** - Internal tools for building and testing the SDK and example apps

### SDK packages

| Package                                 | Description                                                  |
| --------------------------------------- | ------------------------------------------------------------ |
| [`sdk-core`](./packages/sdk-core)       | Framework-agnostic core SDK. Required by all other packages. |
| [`sdk-angular`](./packages/sdk-angular) | Angular integration                                          |
| [`sdk-next`](./packages/sdk-next)       | Next.js integration                                          |
| [`sdk-nuxt`](./packages/sdk-nuxt)       | Nuxt integration                                             |
| [`sdk-preact`](./packages/sdk-preact)   | Preact integration                                           |
| [`sdk-react`](./packages/sdk-react)     | React integration                                            |
| [`sdk-solid`](./packages/sdk-solid)     | SolidJS integration                                          |
| [`sdk-svelte`](./packages/sdk-svelte)   | Svelte integration                                           |
| [`sdk-vue`](./packages/sdk-vue)         | Vue.js integration                                           |

### Example applications

| App                                    | Framework              |
| -------------------------------------- | ---------------------- |
| [`apps/angular`](./apps/angular)       | Angular                |
| [`apps/backend`](./apps/backend)       | Express (backend only) |
| [`apps/next`](./apps/next)             | Next.js                |
| [`apps/nuxt`](./apps/nuxt)             | Nuxt                   |
| [`apps/preact`](./apps/preact)         | Preact                 |
| [`apps/react`](./apps/react)           | React                  |
| [`apps/solidstart`](./apps/solidstart) | Solidstart             |
| [`apps/sveltekit`](./apps/sveltekit)   | SvelteKit              |
| [`apps/vue`](./apps/vue)               | Vue.js                 |

> **Note:** [`apps/backend`](./apps/backend) is a standalone Express server example implementing the [BFF](#bff) pattern - handling the OAuth 2.0 PKCE flow, managing server-side sessions, and exposing a REST API. It's a backend-only implementation that any of the SPA-only framework SDKs (React, Vue, Preact) can pair with instead of talking to the identity provider directly from the browser.
> It is not a standalone example application on its own and isn't required by any other app.

---

## Prerequisites

- [Node.js](https://nodejs.org/) LTS
- [pnpm](https://pnpm.io/) 11+

---

## Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/Strivacity/sdk-js.git
cd sdk-js
pnpm install
```

### Environment configuration

Before running any example application, create a `.env.local` file in the repository root by copying `.env.local.example` and filling in your values:

```bash
cp .env.local.example .env.local
```

| Variable         | Description                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| `VITE_ISSUER`    | Your Strivacity cluster domain (e.g. `https://your-tenant.strivacity.com`) |
| `VITE_CLIENT_ID` | The client ID of your application                                          |
| `VITE_SCOPES`    | Space-separated list of scopes to request (e.g. `openid profile`)          |

---

## Building SDK packages

```bash
pnpm build
```

---

## Running example applications

```bash
pnpm app:angular:serve       # Angular
pnpm app:next:serve          # Next.js
pnpm app:nuxt:serve          # Nuxt
pnpm app:preact:serve        # Preact
pnpm app:react:serve         # React
pnpm app:solidstart:serve    # Solidstart
pnpm app:sveltekit:serve     # SvelteKit
pnpm app:vue:serve           # Vue.js
pnpm app:backend:serve       # Express backend (BFF)
```

### Using the backend app with SPA apps

[`backend`](./apps/backend) application is a standalone Express server that any of the SPA-only example apps ([`apps/vue`](./apps/vue), [`apps/react`](./apps/react), [`apps/preact`](./apps/preact)) can pair with to run in [BFF](#bff) mode instead of talking to the identity provider directly from the browser. This is worth doing because it keeps tokens out of the browser entirely - they're stored in an encrypted, `http-only` cookie on the server.

BFF mode is disabled by default in all three apps - uncomment the `serverSessionUri: '/auth/login'` line to enable it.

To try it, run the backend alongside the SPA app you want to pair it with:

```bash
pnpm app:backend:serve   # Express backend (BFF) - http://localhost:3000
pnpm app:vue:serve       # or app:react:serve / app:preact:serve - http://localhost:4200
```

Once enabled:

- **Login**/**Register** navigate the browser straight to the backend's `/auth/login` (handled by the SDK itself via the `serverSessionUri` option)
- The **Callback**, **Logout**, and **Revoke** pages check `sdk.options.serverSessionUri` and forward the browser to the backend's `/auth/callback`, `/auth/logout`, and `/auth/revoke` routes instead of calling the client SDK's `handleCallback()`, `logout()`, and `revoke()`
- Before rendering, the app fetches the backend's `/auth/session` endpoint (with `credentials: 'include'`) to learn whether the user is authenticated and read the decoded ID token claims - raw tokens are never sent to the browser

See [Server-side session management](./packages/sdk-core/README.md#server-side-session-management) for the underlying SDK option, and [`apps/backend`](./apps/backend) for the server-side implementation.

---

## Terminology

<a id="spa"></a>

### SPA (Single-Page Application)

A **Single-Page Application** loads a single HTML page and updates its content dynamically in the browser via JavaScript, without full page reloads when navigating between views. Routing and rendering happen entirely client-side, after the initial page load.

**In the Strivacity SDKs:** the framework-specific wrappers built for SPA-only frameworks (React, Vue, Preact) run the SDK entirely in the browser (see [CSR](#csr)) - there's no server-side rendering step to integrate with.

<a id="csr"></a>

### CSR (Client-Side Rendering)

**Client-Side Rendering** is the rendering model where the browser downloads a minimal HTML shell and a JavaScript bundle, then renders and updates the UI in the browser. This is how SPAs work by default, and meta-frameworks (Next.js, Nuxt, SvelteKit, SolidStart) can also render individual routes this way when configured for client-only rendering.

**In the Strivacity SDKs:** in CSR setups, the SDK's Client SDK runs directly in the browser, storing tokens in client-side storage (`localStorage` by default) and talking to the identity provider directly - see [Client SDK](./packages/sdk-core/README.md#client-sdk).

<a id="ssr"></a>

### SSR (Server-Side Rendering)

**Server-Side Rendering** is the rendering model where HTML is generated on the server for each request and sent to the browser already populated, then hydrated with JavaScript on the client. This lets a page know the user's authentication state before any client-side JavaScript runs.

**In the Strivacity SDKs:** in SSR setups, the SDK's Server SDK runs on the server, manages the session (typically in an encrypted `http-only` cookie), and can hand the decoded claims down to server-rendered components - see [Server SDK](./packages/sdk-core/README.md#server-sdk).

<a id="dynamic-rendering"></a>

### Dynamic rendering

**Dynamic rendering** is the term some meta-frameworks (notably Next.js's App Router) use for routes that are rendered on the server per request, rather than pre-rendered at build time (static generation). For the purposes of these SDKs it's functionally equivalent to [SSR](#ssr), and the terms are used interchangeably in the framework-specific SDK READMEs where a framework distinguishes rendering strategies at the route level.

<a id="bff"></a>

### BFF (Backend-For-Frontend)

A **Backend-For-Frontend** is a server-side layer that sits between your client application (the browser) and the identity provider (IDP), and optionally your other backend APIs. Instead of the browser talking to the IDP directly and holding tokens itself, the BFF:

- Initiates and completes the OAuth2/OIDC flow on behalf of the browser
- Stores tokens server-side (e.g. in an encrypted, `http-only` cookie or a database), so raw tokens never reach client-side JavaScript
- Optionally proxies authenticated API calls, attaching the access token itself before forwarding the request

**In the Strivacity SDKs:** `@strivacity/sdk-core` ships a server-side implementation of the BFF pattern - it handles the OAuth2/PKCE flow, session storage, token refresh, and (optionally) back-channel logout on your server. Every framework-specific wrapper builds its own server integration on top of it. See the [Server SDK](./packages/sdk-core/README.md#server-sdk) and [Server-side session management](./packages/sdk-core/README.md#server-side-session-management) sections of the core SDK README for details.

---

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md).

## Vulnerability Reporting

See the [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) for reporting security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

Available under the MIT License. See the [LICENSE](./LICENSE) file for details.
