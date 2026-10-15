# Strivacity agent skill

An [Agent Skill](https://docs.claude.com/en/docs/claude-code/skills) that teaches AI coding assistants (Claude Code, Cursor, Codex) how to integrate the Strivacity JavaScript SDKs (`@strivacity/sdk-*` v4) into an application.

It covers:

- Adding login, registration and logout, protected routes, and calling APIs with the access token
- All four authentication modes: `redirect`, `popup`, `embedded`, `native` (custom login UI)
- Server-managed sessions (backend-for-frontend, encrypted http-only cookies, back-channel logout)
- Access tokens for APIs (`audiences`), token storage and refresh
- Debugging failed logins, and upgrading from SDK v3 to v4

Frameworks: **React, Next.js, Vue, Nuxt, Angular, Preact, SolidStart, SvelteKit**, plus plain JavaScript / Node.js through `@strivacity/sdk-core`.

## Install

**Claude Code**

```
/plugin marketplace add Strivacity/sdk-js
/plugin install strivacity@strivacity
```

**Cursor:** add this repository as a plugin marketplace. The manifests are in `.cursor-plugin/` and `plugins/strivacity/.cursor-plugin/`.

**Codex:** the marketplace manifest is in `.agents/plugins/marketplace.json`.

**Other agents:** copy `plugins/strivacity/skills/strivacity/` into the agent's skills directory.

## How it works

The skill is a single router (`skills/strivacity/SKILL.md`). It detects:

1. **The intent:** `integrate`, `feature:native-login`, `feature:server-session`, `feature:api-access`, `guidance`, `debug` or `upgrade-sdk`.
2. **The framework**, from `package.json`.
3. **The mode and session strategy.**

It then loads 2–3 files from `skills/strivacity/references/`:

| Reference                                                           | Content                                         |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| `framework-{react,next,vue,nuxt,angular,preact,solid,svelte,core}/` | Install, setup, login/logout, guards, API usage |
| `mode-{redirect,popup,embedded,native}/`                            | What is specific to each authentication mode    |
| `feature-server-session/`                                           | Server SDK / BFF setup                          |
| `feature-api-access/`                                               | Access tokens for specific APIs (audiences)     |
| `pattern-token-handling/`                                           | Storage, refresh, revoke vs logout, security    |
| `pattern-common-errors/`                                            | Symptom → cause → fix debugging guide           |
| `upgrade-v3-to-v4/`                                                 | Migrating from SDK v3                           |

Each reference is a directory with an `index.md` and must not link to other reference files.

## Development

```bash
pnpm skill:check   # structure + routing checks (evals/skill/)
```

When you add a reference:

1. Create `references/<name>/index.md`.
2. Route to it from Step 4 of `SKILL.md`. For a new framework, also mark it `Yes` in the Step 2 table.
3. Add routing cases to `evals/skill/routing-cases.json`.

Keep code samples in sync with the package sources. If an SDK API changes, the matching reference must change in the same pull request.
