import type { Adapter } from "./Adapter";

export const createLocalforageAdapter = (forage: {
	getItem: (key: string) => Promise<string | null>;
	setItem: (key: string, value: string) => Promise<string>;
}): Adapter => ({
	getItem: async (key: string) => {
		const serializedValue = await forage.getItem(key);

		if (!serializedValue) return undefined;

		return JSON.parse(serializedValue);
	},

	setItem: async (key: string, value: unknown) => {
		await forage.setItem(key, JSON.stringify(value));
	},

	removeItem: async (_: string) => {},

	clear: async () => {},
});
