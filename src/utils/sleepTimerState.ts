import { atom, getDefaultStore } from "jotai";

export const deadlineAtom = atom<number | null>(null);
export const closeAfterPlayEndAtom = atom(false);

/** Consume a due timer once, including when JS timers were suspended in the background. */
export function consumeSleepTimer(trackEnded = false): boolean {
    const store = getDefaultStore();
    const deadline = store.get(deadlineAtom);
    if (deadline === null || deadline > Date.now()) return false;
    if (store.get(closeAfterPlayEndAtom) && !trackEnded) return false;
    store.set(deadlineAtom, null);
    return true;
}
