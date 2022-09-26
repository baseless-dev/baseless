import type { VNode } from "https://esm.sh/preact@10.11.0";
import render from "https://esm.sh/preact-render-to-string@5.2.2";
import Helmet from "https://esm.sh/preact-helmet@4.0.0-alpha-3";
import { apply, setup } from "https://esm.sh/v94/twind@0.16.17/";
import { getStyleTagProperties, shim, virtualSheet } from "https://esm.sh/v94/twind@0.16.17/shim/server";

const sheet = virtualSheet();
setup({
	sheet,
	preflight: {
		html: apply`h-full`,
		body: apply`flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 font-sans font-light`,
		"svg,img": apply`max-w-full max-h-full m-auto`,
		"@import": `url('https://fonts.googleapis.com/css2?family=Roboto:wght@100;300&display=swap')`,
	},
	theme: {
		fill: (theme) => theme("colors"),
	},
});

/**
 * Server Side Render the Preact component
 * @param component Preact component
 * @returns The HTML
 */
export function ssr(component: VNode) {
	sheet.reset();

	const body = render(component);
	const head = Helmet.rewind();

	shim(body);
	const style = getStyleTagProperties(sheet);

	const html = `<!DOCTYPE html>
	<html ${head.htmlAttributes.toString()}>
	<head>
		${head.meta.toString()}
		${head.title.toString()}
		${head.link.toString()}
		<style>${style.textContent}</style>
	</head>
	<body>
		${body}
	</body>
	</html>`;

	return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * Memoizing SSR
 * @param component A Preact component
 * @returns The HTML
 */
export function memoSsr(component: VNode) {
	let memoResponse: Response | undefined;
	return () => {
		const resp = memoResponse ?? (memoResponse = ssr(component));
		return resp.clone();
	};
}
