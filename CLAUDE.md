# CLAUDE.md

Baseless is a typed Backend-For-Frontend (BFF) toolkit for Deno, browser, and related runtimes. The repository is a Deno workspace of JSR
packages: each subdirectory is a published package.

---

## Commands

| Purpose                                    | Command                                                          | Expected                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Run all tests                              | `deno task test`                                                 | exit 0 (one pre-existing failure in `react/Authentication.test.tsx` — register step — is known; all others pass) |
| Run a single test file                     | `deno test -A --unstable-kv <path>`                              | exit 0                                                                                                           |
| Format check                               | `deno fmt --check`                                               | exit 0 on `.ts` files (pre-existing format drift in `plans/*.md` files is known)                                 |
| Format write                               | `deno fmt`                                                       | rewrites in place                                                                                                |
| Lint                                       | `deno task lint`                                                 | exit 0                                                                                                           |
| Type check                                 | `deno task check`                                                | exit 0                                                                                                           |
| Run example (long-running server on :4000) | `cd examples/hello-world && deno run -A --unstable-kv ./main.ts` | prints `Listening on http://127.0.0.1:4000/`                                                                     |

Note: `examples/hello-world/deno.json` defines `deno task start` but that task lacks `--allow-sys`/`--allow-ffi` flags; use the
`deno run -A` form above until that task definition is updated.

**This file rots fast.** If you change tasks in `deno.json` or the test harness shape, update this file in the same commit.

---

## Workspace map

| Package                        | Directory               | Purpose                                                         | Key files                                                                                                             |
| ------------------------------ | ----------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `@baseless/server`             | `server/`               | App builder, server runtime, providers interface, built-in apps | `app.ts` (builder + `Permission`), `server.ts` (request dispatch), `facade.ts` (service facades), `apps/` (built-ins) |
| `@baseless/client`             | `client/`               | Typed client SDK                                                | `client.ts`, `credentials.ts`                                                                                         |
| `@baseless/react`              | `react/`                | React helpers and ceremony-driven auth UI                       | `Authentication.ts`, `useClient.ts`                                                                                   |
| `@baseless/core`               | `core/`                 | Shared domain types, schema, query, errors                      | `schema.ts`, `errors.ts`, `query/`                                                                                    |
| `@baseless/deno-provider`      | `providers/deno/`       | Deno-backed document, KV, queue, hub                            | `document.ts`, `kv.ts`, `hub.ts`                                                                                      |
| `@baseless/inmemory-provider`  | `providers/inmemory/`   | In-memory providers for tests and local dev                     | `document.ts`, `kv.ts`, `storage.ts`                                                                                  |
| `@baseless/universal-provider` | `providers/universal/`  | Shared providers (LibSQL table)                                 | `table.ts` (RLS visitor)                                                                                              |
| example                        | `examples/hello-world/` | Runnable sample app                                             | `main.ts`                                                                                                             |

Built-in server apps live in `server/apps/`: `authentication.ts`, `document.ts`, `pubsub.ts`, `storage.ts`, `table.ts`, `openapi.ts`.

---

## Conventions

- **Formatting**: tabs, line width 140. Run `deno fmt` before committing.
- **Lint rule**: `explicit-function-return-type` is enforced. Every exported function needs a return type annotation.
- **Commit style**: conventional commits — `feat(server): ...`, `fix(core): ...`, `chore: ...`, `docs: ...`, `refactor(server): ...`.
- **JSDoc**: public exports must have JSDoc; JSR renders it as package docs.
- **Schema imports**: always import `* as z from "@baseless/core/schema"`. Never import `zod` directly outside `core/schema.ts`. The
  `core/schema.ts` module wraps and re-exports zod (`export * from "zod"`).

---

## Testing idiom

Tests use the `createMemoryServer` harness exported from `server/server.test.ts`. It wires up all in-memory providers plus a DenoHubProvider
and a LibSQL `file::memory:` client. The returned object implements `Disposable` — use `using` for automatic cleanup.

Real shape from `server/apps/table.test.ts` lines 17–34:

```ts
using mock = await createMemoryServer({
	app: app()
		.extend(tableApp)
		.table({
			path: "users",
			schema: z.object({ id: z.id("id_"), name: z.string(), age: z.optional(z.number()) }),
			tableSecurity: () => Permission.All,
			rowSecurity: ({ q }) => q.equal(q.ref("users", "id"), q.literal(allowedId)),
		})
		.build(),
	configuration: {},
});
```

`mock.fetch(endpoint, { data, schema })` posts JSON and returns the parsed response. `mock.provider.{document,kv,libsql,table,...}` gives
direct access to provider state.

---

## Security model

- **`Permission`**: a bit-field exported from `server/app.ts`. Values include `Permission.All`, `Permission.Read`, `Permission.Write`, and
  individual operation bits. Security callbacks receive the current principal, route params, and services; they return a `Permission` value.
- **Endpoint / document / collection / topic security**: declared as callbacks on each registered resource in the app builder.
- **Row-level security**: table registrations accept a `rowSecurity` callback that returns a SQL expression. The visitor in
  `providers/universal/table.ts` compiles it to a WHERE clause injected at query time.
- **`PublicError` rule**: a handler error reaches the client only if it extends `PublicError` (`core/errors.ts`). Always
  `throw new SomePublicError()` — throwing a plain `Error` results in a generic 500 with no details exposed. Client-safe errors include
  `ForbiddenError`, `BadRequestError`, `DocumentNotFoundError`, etc.

---

## Domain language

Terms are defined in [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md). Use them in code, tests, and commit messages.

---

## Plans

Implementation plans live in `plans/` with status tracked in `plans/README.md`.
