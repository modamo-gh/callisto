import { createContext, ReactNode, useContext } from "react";

const EPGContext = createContext(undefined);

export const EPGProvider: React.FC<{ children: ReactNode }> = ({
	children
}) => {
	return (
		<EPGContext.Provider value={undefined}>{children}</EPGContext.Provider>
	);
};

export const useEPG = () => {
	const context = useContext(EPGContext);

	if (context === undefined) {
		throw new Error("useEPG must be used within an EPGProvider");
	}

	return context;
};
