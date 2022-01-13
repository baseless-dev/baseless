# Hello World

## Run locally

```sh
deno run --import-map=../../import-map.json --allow-net server.ts
```

## Deploy to Cloudflare Workers

```sh
deno bundle --import-map=../../import-map.json worker.ts bundle.js
npx wrangler@beta publish bundle.js
```
