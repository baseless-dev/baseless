import { Fragment, h } from "https://esm.sh/preact@10.11.0";
import { AuthConfiguration } from "https://baseless.dev/x/baseless/auth/config.ts";
import { AuthUIConfiguration, AuthUIContext } from "./mod.ts";
import { AuthenticationType } from "../baseless/auth/signInMethod.ts";

export default function Login({ context, uiConfiguration, configuration }: { context: AuthUIContext; uiConfiguration: AuthUIConfiguration; configuration: AuthConfiguration }) {
	const l10n = uiConfiguration.localization[context.currentLocale];
	const hasEmail = configuration.signInFlow.some(m => m.type === AuthenticationType.Email);
	const oauthMethods = configuration.signInFlow.map(m => {
		if (m.type === AuthenticationType.OAuth) {
			return {
				type: m.type,
				icon: m.oauth.providerIcon ?? "",
				label: l10n.signWithOAuth.signIn(m.oauth.providerLabel),
			}
		}
	}).filter(m => m);
	const hasOAuth = oauthMethods.length > 0;
	return (
		<div class="flex min-h-full">
			<div class="flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
				<div class="mx-auto w-full max-w-sm">
					<div>
						<h2 class="my-6 text-5xl font-thin tracking-tight text-gray-900">
							{l10n.heading}
						</h2>
					</div>
					<div>
						{hasEmail &&
							(
								<div class="mt-6">
									<div>
										<div class="relative mt-6">
											<p class="text-sm text-gray-600">
												{l10n.signWithEmail.heading}
											</p>
										</div>
										<div class="mt-4">
											<form action="#" method="POST" class="space-y-6" autocomplete="off">
												<div>
													<div>
														<div class="relative">
															<label
																for="not_an_email"
																class="relative block rounded-full shadow-md bg-white px-3 py-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
															>
																<div class="pointer-events-none cursor-text">
																	<div class="absolute inset-y-0 left-0 flex items-center pl-4">
																		<div class="h-5 w-5 fill-gray-500">
																			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
																				{/* Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. */}
																				<path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z" />
																			</svg>
																		</div>
																	</div>
																	<span class="block ml-10 text-xs font-medium text-gray-900">E-mail</span>
																</div>
																<input
																	type="email"
																	name="not_an_email"
																	id="not_an_email"
																	class="block w-full border-0 p-0 pl-10 bg-transparent text-gray-900 placeholder-gray-400 focus:ring-0 outline-none sm:text-sm"
																	placeholder={l10n.signWithEmail.placeholder}
																/>
															</label>
															<button
																type="submit"
																class="absolute inset-y-0 right-0 flex justify-center rounded-full border border-transparent bg-indigo-600 py-4 px-6 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
															>
																{l10n.signWithEmail.signIn}
															</button>
														</div>
													</div>
												</div>
											</form>
										</div>
									</div>
								</div>
							)}
						{hasOAuth &&
							(
								<div class="mt-6">
									<div>
										<div class="relative mt-6">
											<p class="text-sm text-gray-600">
												{hasEmail ? l10n.signWithOAuth.heading.withEmail : l10n.signWithOAuth.heading.soleSignIn}
											</p>
										</div>
										<div class="mt-4">
											{oauthMethods.map((method) => (
												<button
													title={method?.label}
													class="inline-flex rounded-full justify-center bg-white p-4 mr-2 text-sm font-medium text-gray-500 shadow-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
												>
													<span class="sr-only">{method?.label}</span>
													<div class="h-5 w-5 fill-gray-500" dangerouslySetInnerHTML={{__html: method?.icon ?? ""}} />
												</button>
											))}
										</div>
									</div>
								</div>
							)}
					</div>
				</div>
			</div>
			<script>
				console.log('woot!');
			</script>
		</div>
	);
}
