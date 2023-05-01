import Layout from "../components/Layout.tsx";

export type LoginPageProps = {};

export default function LoginPage({}: LoginPageProps) {
	return (
		<Layout title="Login">
			<div className="space-y-6">
				<nav className="space-y-1" aria-label="Sidebar">
					...
				</nav>
			</div>
		</Layout>
	);
}
