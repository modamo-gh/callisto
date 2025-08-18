import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const Dashboard = async () => {
	const cookieStore = cookies();
	const accessToken = (await cookieStore).get("trakt_access_token");

	if (!accessToken) {
		redirect("/");
	}

	return (
		<div className="bg-slate-800 flex flex-col gap-2 h-screen items-center justify-center relative w-screen">
			<h1 className="text-cyan-500 text-4xl font-bold mb-8">
				Welcome to Neocable!
			</h1>
			<p className="text-white">
				Successfully authenticated with Trakt. Ready to build your
				channels!
			</p>
		</div>
	);
};

export default Dashboard;
