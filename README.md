# Baseless

[![JSR @baseless](https://jsr.io/badges/@baseless)](https://jsr.io/@baseless)

Baseless is a small, typed Backend For your Frontend (BFF) for Deno, browser and Cloudflare.

It lets you compose an immutable application from typed endpoints and resource surfaces, run it on pluggable providers, and consume the
public contract from a typed client and optional React authentication UI.

## What Baseless is

Baseless is a BFF toolkit built around a fluent App Builder. You register typed resources, attach security rules and hooks, then build an
immutable App that the server can execute.

The public side of that App becomes the contract for the client. Baseless is built around the following model:

- custom HTTP endpoints with typed request and response schemas
- document collections and single documents
- tables with table permissions and row-level security
- files and folders backed by signed upload and download URLs
- pub/sub topics over HTTP and WebSocket
- step-based authentication and registration ceremonies
- a typed client with auth, document, storage, table, and pubsub sub-clients
- React primitives for rendering authentication flows from ceremony state

That makes Baseless less of a generic web framework and more of a typed application surface for frontend-driven products.

## Main features

### Typed app composition

Baseless applications are composed with `app()` and finalized with `.build()`. Builders can register resources directly or extend other
builders and built-in apps.

Common composition patterns include:

- extending reusable apps with `.extend(...)`
- declaring host requirements like configuration and tables
- registering typed endpoints, documents, collections, tables, topics, files, and folders
- attaching lifecycle hooks such as document and topic handlers

Built-in server apps currently cover authentication, documents, pubsub, storage, tables, and OpenAPI generation.

### Typed endpoints

Endpoints are defined with an explicit path, request schema, response schema, and request handler. Security handlers can compute permissions
per request using the current principal, route params, request-scoped context, and services.

This gives you a single place to define:

- the HTTP surface exposed to the client
- the runtime validation contract
- the permission checks for each request
- the TypeScript types that the client can later infer

### Document model with atomic commits and hooks

Baseless treats documents as versioned structured records stored under string keys. Core document capabilities include:

- single-document reads
- multi-get reads
- prefix listing with pagination cursors and limits
- atomic commits with checks, sets, and deletes
- document lifecycle hooks such as `onDocumentSetting`
- topic messages emitted from document changes

This makes the document service suitable for feature flags, user preferences, content records, and other frontend-friendly structured data.

### SQL tables with row-level security

Tables are registered with a typed schema, table-level permissions, and row-level security expressions. Baseless supports:

- execute typed insert and select statements
- deny writes that do not satisfy row-level rules
- transparently filter reads to the rows visible to the current principal

If you need SQL-style querying without giving up application-level access control, this is one of the stronger parts of the model.

### Storage files and folders

Files and folders are first-class resources. The storage layer supports:

- signed upload URLs
- signed download URLs
- metadata retrieval
- file deletion
- folder listing
- permission checks for read-only areas
- content-type and content-length constraints on uploads

This gives you a typed way to expose storage paths like avatars, attachments, or uploads without hand-rolling every signed URL flow.

### Pub/sub over HTTP and WebSocket

Topics can be published through HTTP or WebSocket and subscribed to over WebSocket. Pub/sub capabilities include:

- publishing from an HTTP request
- publishing from a WebSocket client
- subscribing over WebSocket
- topic message hooks on the server

That covers common presence, notifications, and lightweight real-time collaboration cases.

### Authentication ceremonies

Authentication is modeled as an Authentication Ceremony: an ordered or branching plan of factors that drives login or registration. Built-in
flows include:

- email identification prompts
- password verification
- registration with validation codes
- refresh-token issuance and rotation
- sign-out
- multi-factor authentication with OTP
- policy or terms acceptance as a ceremony component

The client and React layers both consume the same ceremony state, so authentication UI can be driven by server-defined steps instead of
duplicated frontend logic.

### Typed client SDK

The client can be cast with `.asTyped<typeof builtApp>()` so its surface reflects the public registry of the server app. Its main
capabilities include:

- authenticated and unauthenticated endpoint fetches
- document get, getMany, list, and atomic commit operations
- typed table execution
- storage metadata, signed URLs, listing, and deletion
- pub/sub publish and subscribe flows
- credentials change tracking and sign-out

The client also manages credentials and token refresh behavior, making it suitable for both browser and server-side consumption.

### React authentication primitives

The React package adds ceremony-driven authentication components and hooks. The React layer supports:

- rendering login and registration UIs from the current prompt
- sending validation codes
- submitting prompts and validation codes
- resetting or moving backward in a ceremony
- wiring authentication state through a client provider

This is not a full design system. It is a thin layer for building your own authentication experience on top of the Baseless ceremony model.

### Provider-based runtime

Baseless separates the application model from storage and infrastructure providers. The available provider abstractions cover:

- documents
- key-value storage
- queues
- notifications
- rate limiting
- object storage
- SQL tables
- pub/sub hubs

Concrete implementations are provided for Deno-native and in-memory environments, with a universal table provider for LibSQL.

### OpenAPI generation

Baseless includes a built-in OpenAPI app that exposes an OpenAPI document for registered endpoints at `/openapi.json`.

## Core concepts

Baseless already defines a strong ubiquitous language in [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md). The most important terms for
new readers are:

| Term                    | Meaning                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| App Builder             | The fluent API used to register resources and compose applications.                                                |
| App                     | The immutable result produced by the builder.                                                                      |
| Public App Registry     | The client-visible contract inferred from public resources.                                                        |
| Endpoint                | A typed HTTP resource with a request schema, response schema, and request handler.                                 |
| Principal               | The request-time authentication context.                                                                           |
| Permission              | A bit-field describing allowed actions like get, set, list, publish, subscribe, select, insert, update, or delete. |
| Authentication Ceremony | The server-defined login or registration flow composed of ordered steps.                                           |
| Collection / Document   | Structured records stored under string keys, with collection-level listing and document-level operations.          |
| Table                   | A queryable row set protected by table permissions and row-level security.                                         |
| Topic                   | A typed pub/sub stream used for real-time messages.                                                                |
| File / Folder           | Registered storage resources used for upload, download, and listing.                                               |

## Package map

This repository is a workspace of small packages rather than one monolith.

| Package                        | Purpose                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `@baseless/server`             | App Builder, server runtime, providers interface, auth helpers, and built-in apps.                                        |
| `@baseless/client`             | Typed client SDK with auth, document, pubsub, storage, and table sub-clients.                                             |
| `@baseless/react`              | React helpers for client access and ceremony-driven authentication UI.                                                    |
| `@baseless/core`               | Shared schema, identity, authentication, query, request, response, and domain types.                                      |
| `@baseless/deno-provider`      | Deno-backed document, KV, queue, and hub providers.                                                                       |
| `@baseless/inmemory-provider`  | In-memory providers for local development and ephemeral environments, including notification, storage, and rate limiting. |
| `@baseless/universal-provider` | Shared provider implementations such as the LibSQL table provider.                                                        |

## Example

This is a representative server builder:

```ts
import { app, Permission, Response, z } from "@baseless/server";
import documentApp from "@baseless/server/apps/document";

const api = app()
	.extend(documentApp)
	.endpoint({
		path: "hello",
		request: z.request(),
		response: z.textResponse(),
		handler: () => Response.text("Hello World"),
	})
	.collection({
		path: "posts",
		schema: z.object({ postId: z.id("p_"), title: z.string() }),
		collectionSecurity: () => Permission.All,
		documentSecurity: () => Permission.All,
		topicSecurity: () => Permission.All,
	})
	.build();
```

And the client can consume that contract as a typed surface:

```ts
import { Client } from "@baseless/client";

const client = new Client({
	baseUrl: new URL("http://127.0.0.1:4000/"),
}).asTyped<typeof api>();

const hello = await client.fetch("hello");
const posts = await Array.fromAsync(client.document.list("posts", {}));
```

## Getting started in this repository

Run the included example application:

```sh
cd examples/hello-world
deno task start
```

With the example server running, fetch the generated OpenAPI document:

```sh
curl -H 'accept: application/json' 'http://127.0.0.1:4000/openapi.json?ui=swagger'
```

See [examples/hello-world](./examples/hello-world) for the runnable sample app.
