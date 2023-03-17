export interface LayoutProps {
	title: string;
}

export default function Layout({ title }: LayoutProps, children: string[]) {
	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
</head>
<body>
	<div id="page">
		<div>
			${children.join("")}
		</div>
	</div>
	<style>
		*, ::before, ::after {
			box-sizing: border-box;
			border-width: 0;
			border-style: solid;
			border-color: #e5e7eb;
		}
		html, body {
			margin: 0;
			height: 100%;
		}
		html {
			font-size: min(16px, calc(100vw / 30));
			line-height: 1.5;
			-webkit-text-size-adjust: 100%;
			-moz-tab-size: 4;
			tab-size: 4;
			font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
			font-feature-settings: normal;
		}
		body {
			background: #f3f4f6;
		}
		#page {
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			min-height: 100%;
			padding: 1.5rem 1.25rem;
		}
		#page > div {
			margin: 0 auto;
			width: 100%;
			max-width: 24rem;
		}
		figure {
			display: inline-block;
			margin: 0;
			width: 1rem;
		}
		header {
			text-align: center;
		}
		header figure {
			width: 3rem;
			fill: #6b7280;
		}
		header h1 {
			margin: 0 auto;
			font-weight: 400;
			letter-spacing: -0.025em;
			font-size: 1.875rem;
			line-height: 2.25rem;
			color: rgb(31 41 55);
		}
		.box {
			margin: 3rem 0 0;
			background: #ffffff;
			padding: 1.25rem;
			border-radius: 3px;
			box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
		}
		#login ul {
			display: flex;
			flex-direction: column;
			list-style: none;
			margin: 0 -1.25rem;
			padding: 0;
		}
		#login ul li {
			display: flex;
			flex-direction: row;
		}
		#login ul li > button {
			position: relative;
			display: flex;
			flex-direction: row;
			flex: 1;
			align-items: center;
			gap: 2rem;
			padding: 1.25rem 2.5rem;
			background: none;
			cursor: pointer;
			border: 1px solid transparent;
		}
		#login ul li > button:not(:disabled):hover,
		#login ul li > button:focus {
			box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
			background: rgb(243 244 246);
			outline: 0;
		}
		#login ul li > button > figure {
			display: flex;
			flex-grow: 0;
			align-items: center;
			margin: 0;
			width: 2.5rem;
			height: 2.5rem;
			fill: rgb(55 65 81);
		}
		#login ul li > button > span {
			font-size: 1.25rem;
			line-height: 1.5rem;
			color: rgb(55 65 81);
		}
		.back {
			display: flex;
			flex-direction: row;
			text-decoration: none;
			color: inherit;
			font-size: 0.85rem;
			line-height: 1rem;
			background: none;
			color: rgb(55 65 81);
			margin: 0 0 0.5rem 0;
			cursor: pointer;
		}
		.back:hover,
		.back:focus {
			text-decoration: underline;
			outline: 0;
		}
		.back > figure {
			flex-grow: 0;
			margin: 0 0.25rem 0 0;
		}
		h2 {
			margin: 0 0 1rem 0;
		}
		input {
			display: block;
			width: 100%;
			padding: 0.5rem 0;
			border-bottom: 1px solid black;
			outline: 0;
			font-size: 1rem;
		}
		footer {
			display: flex;
			flex-direction: row;
			justify-content: end;
			margin: 1rem 0 0 0;
		}
		.submit {
			display: block;
			padding: 1rem 1.25rem;
			background: blue;
			color: white;
			cursor: pointer;
		}
	</style>
</body>
</html>`;
}
