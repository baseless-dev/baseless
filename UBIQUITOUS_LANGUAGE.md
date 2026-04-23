# Ubiquitous Language

## Application model

| Term                    | Definition                                                                                                            | Aliases to avoid                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **App**                 | An immutable Baseless application that holds the registered resources and compiled path matchers.                     | Server, router, builder           |
| **App Builder**         | The fluent composition surface used to register resources and then build an App.                                      | App, bootstrap, config object     |
| **App Registry**        | The complete type-level catalog of resources, services, context, and requirements registered with an App.             | Manifest, schema, public registry |
| **Public App Registry** | The client-facing subset of the App Registry that exposes only public resources.                                      | App Registry, server registry     |
| **Extension**           | The act of merging one App Builder into another, optionally under an endpoint prefix.                                 | Import, include, composition      |
| **Requirement**         | A resource, service, configuration value, or context value that a host app must provide before an Extension is valid. | Dependency, prerequisite, default |

## Request and access control

| Term                   | Definition                                                                                                                   | Aliases to avoid                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Endpoint**           | A typed HTTP resource defined by a path, request schema, response schema, and Request Handler.                               | Route, RPC, controller                   |
| **Principal**          | The runtime authentication context for a request, containing an identity id and scopes or no identity at all.                | Auth, current user, session              |
| **Permission**         | A bit-field of allowed actions on a resource, such as get, set, list, publish, subscribe, select, insert, update, or delete. | Scope, role, policy                      |
| **Request Handler**    | The function that processes an Endpoint request and returns the typed response.                                              | Controller, endpoint                     |
| **Security Handler**   | The function that computes which Permissions a Principal has for a resource or operation.                                    | Auth check, guard, policy                |
| **Row-level Security** | A table security rule that filters visible rows with a boolean expression per Principal.                                     | Table filter, where clause               |
| **Decoration**         | Request-scoped context added before handlers run.                                                                            | Middleware state, local context, service |
| **Service Collection** | The bag of built-in and app-defined services injected into handlers.                                                         | Context, container, utilities            |
| **Lifecycle Hook**     | A handler triggered around document, file, or topic events rather than by a direct Endpoint request.                         | Trigger, listener, callback              |

## Client interaction

| Term                  | Definition                                                                                              | Aliases to avoid                  |
| --------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Client**            | The main Baseless runtime that talks to public resources over HTTP and WebSocket.                       | App, SDK wrapper                  |
| **Sub-client**        | A specialized Client surface for one resource family such as auth, document, pubsub, table, or storage. | Namespace, helper                 |
| **Credentials**       | The client-side set of stored Authentication Tokens plus the currently active identity.                 | Session, login state, token cache |
| **Credentials Store** | The persistence backend that saves and restores Credentials.                                            | Cache, session store              |

## Authentication and identity

| Term                        | Definition                                                                                                            | Aliases to avoid            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Identity**                | The authenticated subject represented by a stable Baseless identifier and associated data.                            | User, account, profile      |
| **Authentication**          | The flow that proves an existing Identity and can culminate in Session issuance.                                      | Sign-in, login              |
| **Registration**            | The flow that creates a new Identity and attaches its initial factors and delivery channels.                          | Sign-up, onboarding         |
| **Authentication Ceremony** | The ordered and branching plan that defines which factors must be completed for Authentication or Registration.       | Flow, auth tree, procedure  |
| **Ceremony Component**      | A named factor reference inside an Authentication Ceremony, such as email or password.                                | Component, factor           |
| **Prompt**                  | The user-facing input request presented for one step of a ceremony.                                                   | Field, challenge, component |
| **Authentication Step**     | One in-progress ceremony state containing the next Prompt, an opaque state token, and an expiry time.                 | State, challenge            |
| **Authentication Response** | The result of a ceremony action, which is either another Authentication Step or Authentication Tokens.                | Result, reply               |
| **Identity Component**      | A factor bound to an Identity, optionally indexed by an Identification value and tracked as confirmed or unconfirmed. | Component, factor           |
| **Identification**          | The unique lookup value of an Identity Component, such as an email address.                                           | Username, login             |
| **Identity Channel**        | A delivery address bound to an Identity for validation codes or other notifications.                                  | Contact, channel, component |
| **Validation Code**         | A short-lived code sent during a ceremony to confirm a Prompt or an Identity Channel.                                 | OTP, code                   |
| **Authentication Tokens**   | The client-facing token bundle returned when a ceremony or token refresh succeeds.                                    | Credentials, session        |
| **Session**                 | The server-side grant that records one Identity, its issued-at time, and its scopes.                                  | Tokens, auth context, login |
| **Scope**                   | A permission claim string granted to a Session and carried by issued tokens.                                          | Role, permission            |

## Resources and data

| Term                | Definition                                                                             | Aliases to avoid                  |
| ------------------- | -------------------------------------------------------------------------------------- | --------------------------------- |
| **Collection**      | A listable document namespace defined by a shared path prefix and schema.              | Folder, table, bucket             |
| **Document**        | A versioned structured record stored under a string key in the document service.       | Object, row, file                 |
| **Atomic Commit**   | A batch of document checks and mutations that must succeed as one unit.                | Transaction, batch update         |
| **Versionstamp**    | The opaque concurrency marker that identifies a specific stored version of a Document. | Revision, etag                    |
| **Table**           | A registered queryable row set with table-level and row-level security rules.          | Collection, sheet, document store |
| **Key-Value Store** | A service that stores arbitrary values under string keys outside the document model.   | Cache, document store             |
| **File**            | A registered storage path for one downloadable and uploadable binary resource.         | Storage object, blob path         |
| **Folder**          | A listable storage prefix that groups File resources under a shared path.              | Directory, collection, bucket     |
| **Storage Object**  | The concrete stored file plus its metadata in the storage service.                     | Document, blob, asset             |
| **Signed URL**      | A time-limited URL that grants upload or download access to one Storage Object.        | Presigned link, temporary URL     |

## Messaging and operations

| Term             | Definition                                                                                 | Aliases to avoid |
| ---------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| **Topic**        | A named pub/sub stream to which payloads are published and from which clients subscribe.   | Channel, queue   |
| **Notification** | A message intended for delivery through an Identity Channel or another outbound mechanism. | Alert, event     |
| **Rate Limiter** | A service that enforces request or action limits over time.                                | Throttle, quota  |

## Relationships

- An **App Builder** produces an immutable **App** when it is built.
- An **App Registry** contains the full resource set for an **App**, while the **Public App Registry** contains only the resources exposed
  to the **Client**.
- An **Extension** merges one **App Builder** into another and is valid only when the host satisfies the child app's **Requirements**.
- An **Endpoint** has exactly one **Request Handler**, and access to a resource is evaluated by one or more **Security Handlers**.
- A **Decoration** and a **Service Collection** are both visible to handlers, but only the **Service Collection** exposes reusable
  operations.
- A **Principal** is resolved per request from credentials, while a **Session** is the stored server-side grant from which **Authentication
  Tokens** are issued.
- A **Client** holds **Credentials** and reaches public **Endpoints**, **Documents**, **Topics**, **Tables**, **Files**, and **Folders**
  through its **Sub-clients**.
- A **Collection** contains zero or more **Documents**, a **Folder** contains zero or more **Files**, and a **Table** contains zero or more
  rows.
- **Row-level Security** filters which **Table** rows a **Principal** can see after table-level **Permission** checks succeed.
- A **Validation Code** is commonly delivered through an **Identity Channel** to validate an **Identity Component** during
  **Authentication** or **Registration**.

## Example dialogue

> **Dev:** "When we extend a child app under `/admin`, do all of its resources become public?"
>
> **Domain expert:** "No. The **App Registry** keeps the full resource set, while the **Public App Registry** exposes only the public
> **Endpoints**, **Documents**, **Topics**, **Tables**, **Files**, and **Folders**."
>
> **Dev:** "So the **Client** can only reach the public side, using its **Credentials** to resolve a **Principal** on each request?"
>
> **Domain expert:** "Exactly. The **Session** stays server-side, the **Credentials** store **Authentication Tokens**, and each request
> resolves a **Principal** for the **Security Handler**."
>
> **Dev:** "Where should shared helpers live when an **Endpoint** and a **Lifecycle Hook** both need them?"
>
> **Domain expert:** "Put reusable operations in the **Service Collection** and request-scoped values in a **Decoration**; both reach the
> handler, but they mean different things."

## Flagged ambiguities

- "app" is overloaded between the factory, the fluent builder, and the immutable result. Use **App Builder** for composition and **App** for
  the built runtime.
- "registry" is overloaded between the full catalog and the client-facing subset. Use **App Registry** for the full set and **Public App
  Registry** for the exposed subset.
- "auth" can mean the runtime request context, the overall sign-in flow, or the auth module. Use **Principal** for request-time auth
  context, **Authentication** for the identity-proof flow, and **Session** for the persisted server-side grant.
- "handler" covers several distinct concepts. Use **Request Handler**, **Security Handler**, or **Lifecycle Hook** according to timing and
  purpose.
- "permission" and "scope" are not synonyms. A **Permission** is a resource-operation bit-field, while a **Scope** is a claim string
  attached to a **Session** and its tokens.
- "document", "file", and "storage object" are separate concepts. Use **Document** for structured versioned records, **File** for a
  registered storage path, and **Storage Object** for the concrete stored blob plus metadata.
- "collection", "folder", and "table" all group things but are not interchangeable. Use **Collection** for documents, **Folder** for storage
  paths, and **Table** for queryable rows.
- "component" is overloaded across the codebase. Use **Ceremony Component** for a node in the ceremony, **Prompt** for the user-facing input
  request, and **Identity Component** for the factor stored on an Identity.
- "session", "credentials", and "authentication tokens" should not be used interchangeably. A **Session** is server-side, **Authentication
  Tokens** are issued artifacts, and **Credentials** are the client's stored token set.
