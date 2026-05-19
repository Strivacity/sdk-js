![JavaScript SDK](https://static.strivacity.com/images/javascript-sdk.png)

# Strivacity JavaScript SDK

This repository contains the Strivacity JavaScript SDK — a collection of framework-specific packages and example applications for integrating Strivacity's policy-driven authentication journeys into JavaScript and TypeScript applications.

The SDK uses the OAuth 2.0 PKCE flow and supports `redirect`, `popup`, `native`, and `embedded` modes.

---

## Repository structure

This is a pnpm monorepo. It contains:

- **`packages/`** — Publishable SDK packages
- **`apps/`** — Example applications for each framework

### SDK packages

| Package                                 | Description                                                  |
| --------------------------------------- | ------------------------------------------------------------ |
| [`sdk-core`](./packages/sdk-core)       | Framework-agnostic core SDK. Required by all other packages. |
| [`sdk-angular`](./packages/sdk-angular) | Angular integration                                          |
| [`sdk-next`](./packages/sdk-next)       | Next.js integration                                          |
| [`sdk-nuxt`](./packages/sdk-nuxt)       | Nuxt integration                                             |
| [`sdk-react`](./packages/sdk-react)     | React integration                                            |
| [`sdk-remix`](./packages/sdk-remix)     | Remix integration                                            |
| [`sdk-svelte`](./packages/sdk-svelte)   | Svelte integration                                           |
| [`sdk-vue`](./packages/sdk-vue)         | Vue.js integration                                           |

### Example applications

| App                                          | Framework                           |
| -------------------------------------------- | ----------------------------------- |
| [`apps/web-component`](./apps/web-component) | Vanilla JS / Web Component          |
| [`apps/angular`](./apps/angular)             | Angular                             |
| [`apps/angular-bff`](./apps/angular-bff)     | Angular (Backend for Frontend)      |
| [`apps/next`](./apps/next)                   | Next.js                             |
| [`apps/next-headless`](./apps/next-headless) | Next.js (headless / Native Journey) |
| [`apps/nuxt`](./apps/nuxt)                   | Nuxt                                |
| [`apps/react`](./apps/react)                 | React                               |
| [`apps/remix`](./apps/remix)                 | Remix                               |
| [`apps/svelte`](./apps/svelte)               | Svelte                              |
| [`apps/vue`](./apps/vue)                     | Vue.js                              |
| [`apps/ionic-angular`](./apps/ionic-angular) | Ionic + Angular                     |
| [`apps/ionic-react`](./apps/ionic-react)     | Ionic + React                       |
| [`apps/ionic-vue`](./apps/ionic-vue)         | Ionic + Vue.js                      |

> **Note:** [`apps/backend`](./apps/backend) is an Express server exclusively for the `angular-bff` example. It implements the Backend for Frontend (BFF) pattern - handling the OAuth 2.0 PKCE flow, managing server-side sessions, and exposing a `/api/session/*` REST API that the Angular BFF frontend calls instead of communicating with the identity provider directly.
> It is not a standalone example application and is not needed by any other app.

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
pnpm app:wc:serve            # Web Component
pnpm app:angular:serve       # Angular
pnpm app:next:serve          # Next.js
pnpm app:next-headless:serve # Next.js headless
pnpm app:nuxt:serve          # Nuxt
pnpm app:react:serve         # React
pnpm app:remix:serve         # Remix
pnpm app:vue:serve           # Vue.js
pnpm app:ionic-angular:serve # Ionic + Angular
pnpm app:ionic-react:serve   # Ionic + React
pnpm app:ionic-vue:serve     # Ionic + Vue.js
pnpm app:angular-bff:serve   # Angular (Backend for Frontend)
pnpm app:backend:serve       # BFF backend (required for angular-bff)
```

---

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md).

## Vulnerability Reporting

See the [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) for reporting security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

Available under the MIT License. See the [LICENSE](./LICENSE) file for details.
