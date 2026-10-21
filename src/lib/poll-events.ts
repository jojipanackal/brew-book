export type PollEvent = { companyId: string; date?: string };
type Listener = (event: PollEvent) => void;

// Nitro startup plugins and Start route bundles must share the same hub.
const global = globalThis as typeof globalThis & {
	brewbookPollListeners?: Set<Listener>;
};
global.brewbookPollListeners ??= new Set<Listener>();
const listeners = global.brewbookPollListeners;

export function subscribeToPolls(listener: Listener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function publishPollChange(companyId: string, date?: string) {
	for (const listener of listeners) listener({ companyId, date });
}
