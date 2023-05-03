import { Helmet, PropsWithChildren } from "../deps.ts";

export type LayoutProps = {
	title: string;
	subTitle?: string;
	// TODO favicon
	// TODO logo
};
export default function Layout(
	{ title, subTitle, children }: PropsWithChildren<LayoutProps>,
) {
	return (
		<div className="flex min-h-screen bg-gradient-to-b from-slate-300 to-white">
			<Helmet>
				<title>{title}</title>
				<meta charSet="utf-8" />
				<link rel="icon" type="image/svg+xml" href="/favicon.svg"></link>
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			</Helmet>
			<div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-6">
				<div className="mx-auto shadow-xl rounded-lg border border-slate-200 p-5 w-full max-w-sm lg:w-96 bg-gradient-to-b from-slate-100 to-slate-50">
					<div className="text-center">
						<div className="inline-block my-6">
							<img className="h-12 w-auto" src="/favicon.svg" alt="Logo" />
						</div>
						<h2 className="m-0 text-2xl font-bold tracking-tight text-slate-700">
							{title}
						</h2>
						{subTitle &&
							`<p className="mt-2 text-sm text-slate-500">${subTitle}</p>`}
					</div>
					<div className="mt-6">
						{children}
					</div>
				</div>
				<div className="mt-10">
					<p className="text-center text-xs text-slate-300">
						Powered by{" "}
						<a href="https://baseless.dev/" target="_blank">Baseless</a>
					</p>
				</div>
			</div>
		</div>
	);
}
