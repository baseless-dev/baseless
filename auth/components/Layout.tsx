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
		<div className="flex min-h-screen bg-gradient-to-b from-gray-300 to-white dark:from-gray-800 dark:to-gray-900">
			<Helmet>
				<title>{title}</title>
				<meta charSet="utf-8" />
				<link rel="icon" type="image/svg+xml" href="/favicon.svg"></link>
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			</Helmet>
			<div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-6">
				<div className="mx-auto shadow-xl rounded-lg border p-5 w-full max-w-sm lg:w-96 border-gray-200 bg-gradient-to-b from-gray-100 to-gray-50 dark:shadow-gray-950 dark:border-gray-800 dark:from-gray-800 dark:to-gray-850">
					<div className="text-center">
						<div className="inline-block my-6">
							<div className="h-12 w-auto fill-gray-700 dark:fill-gray-100">
								<svg
									className="h-full"
									xmlns="http://www.w3.org/2000/svg"
									xmlnsXlink="http://www.w3.org/1999/xlink"
									xmlSpace="preserve"
									viewBox="0 0 300 300"
								>
									<symbol id="logo_symbol" viewBox="-124.48 0 248.96 321.35">
										<path d="M105.04 188.38c.38.55.76 1.09 1.12 1.65 7.65 11.77 11.48 25.97 11.48 42.6 0 28.84-10.78 50.83-32.33 65.99-21.56 15.15-53.01 22.73-94.35 22.73h-115.43V189.57l117.25-28.16 112.26 26.97zm5.98-49.11c-.03.04-.06.07-.09.11L-4.24 111.72c-.98-.24-1.99-.35-3-.35s-2.02.12-3 .35l-114.24 27.44V0H5.96C45.1.29 74.63 8.35 94.57 24.17c19.94 15.81 29.91 39.47 29.91 70.96 0 17.35-4.49 32.07-13.46 44.14z" />
									</symbol>
									<use
										xlinkHref="#logo_symbol"
										id="B"
										width="248.96"
										height="321.35"
										x="-124.48"
										overflow="visible"
										transform="matrix(.78 0 0 -.78 156 275.333)"
									/>
								</svg>
							</div>
						</div>
						<h2 className="m-0 text-2xl font-bold tracking-tight text-gray-700 dark:text-gray-100">
							{title}
						</h2>
						{subTitle &&
							`<p className="mt-2 text-sm text-gray-500 dark:text-gray-200">${subTitle}</p>`}
					</div>
					<div className="mt-6">
						{children}
					</div>
				</div>
				<div className="mt-10">
					<p className="text-center text-xs text-gray-300 dark:text-gray-800">
						Powered by{" "}
						<a href="https://baseless.dev/" target="_blank">Baseless</a>
					</p>
				</div>
			</div>
		</div>
	);
}
