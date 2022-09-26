import { Fragment, h, ComponentChildren } from "https://esm.sh/preact@10.11.0";
import Helmet from "https://esm.sh/preact-helmet@4.0.0-alpha-3";

export default function Frame({ children }: { children: ComponentChildren }) {
	return (<div class="flex flex-col justify-center align-items-center min-h-full px-5 py-6">
		<Helmet meta={[
			{ charset: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1.0' }
		]} />
		{children}
		<script>
			
		</script>
	</div>);
}