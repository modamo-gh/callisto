import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import traktRequest from "../lib/trakt";

const Dashboard = async () => {
	const cookieStore = cookies();
	const accessToken = (await cookieStore).get("trakt_access_token");

	if (!accessToken) {
		redirect("/");
	}

	let userData = null;
	let watchlist = null;
	let trending = null;

	try {
		userData = await traktRequest("/users/me");
		watchlist = await traktRequest("/users/me/watchlist");
		trending = await traktRequest("/movies/trending?limit=10");
	} catch (error) {
		console.error("Error fetching Trakt data:", error);
	}

	return (
		<div className="bg-slate-800 flex flex-col gap-2 h-screen items-center justify-center relative w-screen">
			<h1 className="text-cyan-500 text-4xl font-bold">
				Welcome to Neocable!
			</h1>
			{trending && console.log(JSON.stringify(trending, null, 4))
			}
            {/* {watchlist && (
				<div>
					<h2>Watchlist:</h2>
					<pre>{JSON.stringify(watchlist, null, 4)}</pre>
				</div>
			)} */}
            {trending && (
				<div>
					<h2>Trending:</h2>
					<pre>{JSON.stringify(trending, null, 4)}</pre>
				</div>
			)}
		</div>
	);
};

export default Dashboard;
