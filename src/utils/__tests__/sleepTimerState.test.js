const {getDefaultStore} = require('jotai');
const {deadlineAtom, closeAfterPlayEndAtom, consumeSleepTimer} = require('../sleepTimerState');

beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T12:00:00Z'));
    getDefaultStore().set(deadlineAtom, null);
    getDefaultStore().set(closeAfterPlayEndAtom, false);
});

afterEach(() => jest.useRealTimers());

it('waits until the deadline and consumes the timer exactly once', () => {
    getDefaultStore().set(deadlineAtom, Date.now() + 1000);
    expect(consumeSleepTimer()).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(consumeSleepTimer()).toBe(true);
    expect(consumeSleepTimer()).toBe(false);
    expect(getDefaultStore().get(deadlineAtom)).toBe(null);
});

it('waits for track end when finish-current-song is enabled', () => {
    getDefaultStore().set(deadlineAtom, Date.now() - 1000);
    getDefaultStore().set(closeAfterPlayEndAtom, true);
    expect(consumeSleepTimer()).toBe(false);
    expect(consumeSleepTimer(true)).toBe(true);
    expect(consumeSleepTimer(true)).toBe(false);
});

it('does not stop a track early or after the timer was cancelled', () => {
    getDefaultStore().set(deadlineAtom, Date.now() + 1000);
    getDefaultStore().set(closeAfterPlayEndAtom, true);
    expect(consumeSleepTimer(true)).toBe(false);
    getDefaultStore().set(deadlineAtom, null);
    jest.advanceTimersByTime(5000);
    expect(consumeSleepTimer(true)).toBe(false);
});
