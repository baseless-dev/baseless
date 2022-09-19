import { Helmet, renderSSR } from "https://deno.land/x/nano_jsx@v0.0.32/mod.ts";
import { apply, setup } from "https://esm.sh/v94/twind@0.16.17/";
import type { TW } from "https://esm.sh/v94/twind@0.16.17/";
import { getStyleTag, shim, virtualSheet } from "https://esm.sh/v94/twind@0.16.17/shim/server";

const sheet = virtualSheet();

setup({
	sheet,
	preflight: {
		html: apply`h-full`,
		body: apply`flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 font-sans font-light`,
		"@import": `url('https://fonts.googleapis.com/css2?family=Roboto:wght@100;300&display=swap')`,
	},
	theme: {
		fontFamily: {
			"sans": ["Roboto", "Helvetica", "Arial", "sans-serif"],
		},
		fill: (theme) => theme('colors')
	},
});

export function ssr(component: CallableFunction, twindOptions?: TW): Response {
	try {
		sheet.reset();
		const app = `${renderSSR(component(), {})}`;
		shim(app, twindOptions);
		const { body, head, footer } = Helmet.SSR(app);
		const style = getStyleTag(sheet);
		return new Response(
			`<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		${head.join("\n")}
		${style}
	</head>
	<body>
		${body}
		${footer.join("\n")}
	</body>
	<html>`,
			{ headers: { "Content-Type": "text/html; charset=utf-8" } },
		);
	} catch (err) {
		console.log(err);
		return new Response(
			`<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title></title>
	</head>
	<body>
		... ${err}
	</body>
	<html>`,
			{ status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
		);
	}
}

export function memoSSR(component: CallableFunction, twindOptions?: TW) {
	let mresp: Response | undefined;
	return () => {
		const resp = mresp ?? (mresp = ssr(component, twindOptions));
		return resp.clone();
	};
}
