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
		<div className="flex min-h-full">
			<Helmet>
				<title>{title}</title>
				<meta charSet="utf-8" />
				<link rel="icon" type="image/svg+xml" href="/favicon.svg"></link>
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			</Helmet>
			<div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6">
				<div className="bg-white mx-auto shadow-2xl rounded-md p-5 w-full max-w-sm lg:w-96">
					<div className="text-center">
						<div className="inline-block">
							<img className="h-12 w-auto" src="/favicon.svg" alt="Logo" />
						</div>
						<h2 className="mt-6 text-2xl font-bold tracking-tight text-gray-900">
							{title}
						</h2>
						{subTitle &&
							`<p className="mt-2 text-sm text-gray-500">${subTitle}</p>`}
					</div>

					<div className="mt-6">
						{children}
					</div>
				</div>
				<div className="mt-10">
					<p className="text-center text-xs text-neutral-300">
						Powered by Baseless
					</p>
				</div>
			</div>
		</div>
	);
}
