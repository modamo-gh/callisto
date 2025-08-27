import { Dispatch, SetStateAction } from "react";

export type Channel = {
	name: string;
	programs: (Episode | Program | Show)[];
};

export type Credentials = {
	client_id: string;
	client_secret: string;
};

export type DeviceCode = {
	device_code: string;
	user_code: string;
	interval: number;
	expires_in: number;
	verification_url: string;
	direct_verification_url: string;
};

export type EPGClientProps = {
	channels: Channel[];
};

export type EPGContextType = {
	channels: Channel[];
	currentChannelIndex: number;
	episodeMetaCache: Map<number, EpisodeMeta>;
	episodeTMDBCache: Map<number, any>;
	ensureProgramMeta: (program: Episode | Program | Show) => Promise<void>;
	fetchEpisodeMeta: (
		program: Episode | Show
	) => Promise<EpisodeMeta | null | undefined>;
	fetchEpisodeTMDB: (show: Show) => Promise<any>;
	fetchMovieMeta: (program: Program) => Promise<ProgramMeta | undefined>;
	fetchMovieTMDB: (program: Program) => Promise<any>;
	fetchProgramLink: (program: Episode | Program | Show) => Promise<void>;
	getProgramMeta: (
		program: Episode | Program | Show
	) => EpisodeMeta | ProgramMeta | null;
	fetchShowTMDB: (show: Show) => Promise<any>;
	movieMetaCache: Map<number, ProgramMeta>;
	setCurrentChannelIndex: Dispatch<SetStateAction<number>>;
	showTMDBCache: Map<number, any>;
};

export type Episode = Program & {
	episodeTitle: string;
	episodeTMDB: number;
	number: number;
	season: number;
};

export type EpisodeMeta = ProgramMeta & {
	episodeNumber?: number;
	episodeTitle?: string;
	season?: number;
};

export type Genre = {
	id: number;
	name: string;
};

export type Program = {
	id: string;
	kind: ProgramKind;
	title: string;
	tmdb: number;
};

export type ProgramKind = "episode" | "movie" | "tv";

export type ProgramMeta = {
	genres?: string[];
	link?: string | null;
	overview: string;
	releaseDate: string;
	runtime: number;
};

export type Show = Program & { episodeTMDB: null | number };

export type TraktProgram = {
	ids: { tvdb: number; tmdb: number };
	show: { ids: { tvdb: number; tmdb: number }; title: string };
	title: string;
	episode: {
		title: string;
		ids: { tmdb: number };
		number: number;
		season: number;
	};
	movie: { title: string; ids: { tmdb: number } };
};

export type Tokens = {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
	token_type: string;
};
