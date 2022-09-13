import { AuthRenderer } from "./config.ts";

export interface Branding {
	title?: string,
	logo?: string,
	favicon?: {
		ico?: string;
		png?: string;
	}
}

export function createAuthRenderer(branding?: Branding): AuthRenderer {
	return {
		login() {
			return new Response(Frame('', branding), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
		},
		password() {
			return new Response(null, { status: 405 });
		},
		passwordReset() {
			return new Response(null, { status: 405 });
		},
		forgotPassword() {
			return new Response(null, { status: 405 });
		},
		otp() {
			return new Response(null, { status: 405 });
		},
		hotp() {
			return new Response(null, { status: 405 });
		},
		totp() {
			return new Response(null, { status: 405 });
		},
		logout() {
			return new Response(null, { status: 405 });
		}
	}
}

function Frame(content: string, branding?: Branding): string {
	return `<!DOCTYPE html>
<html lang="en" class="">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	${branding?.favicon?.ico && `<link rel="icon" href="${branding.favicon.ico}" />` || ''}
	${branding?.favicon?.png && `<link rel="icon" type="image/png" href="${branding.favicon.png}" />` || ''}
	<title>${branding?.title ?? 'Baseless'}</title>
	<style>
		:root {
			--bg-gray: rgb(249, 250, 251);
			--bg-white: rgb(255, 255, 255);
		}
		*, ::after, ::before {
			box-sizing: border-box;
			border-width: 0;
			border-style: solid;
			border-color: #e5e7eb;
		}
		html {
			height: 100%;
			margin: 0;
		}
		body {
			background-color: var(--bg-gray);
			height: 100%;
			margin: 0;
			overflow: hidden;
			display: flex;
		}
		#page {
			display: flex;
			flex: 1;
			padding: 3rem 2rem;
			flex-direction: column;
			align-items: justify;
			justify-content: center;
		}
		#page > section {
			width: 100%;
			max-width: 28rem;
			margin: 0 auto;
		}
		h1 {
			margin: 0;
			text-align: center;
			font-size: 3rem;
		}
		#page > section > section {
			width: 100%;
			max-width: 28rem;
			margin: 0 auto;
			padding: 2rem;
			border-radius: 0.5rem;
			background: var(--bg-white);
		}
	</style>
</head>
<body>
	<div id="page">
		<section>
			<header>
				<h1>${branding?.title ?? 'Baseless'}</h1>
			</header>
			<section>
				${content}
			</section>
		</section>
	</div>
</body>
</html>`
}