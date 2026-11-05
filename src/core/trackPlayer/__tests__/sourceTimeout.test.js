const {beforeDeadline} = require('../sourceTimeout');
const axios = require('axios');

afterEach(() => jest.useRealTimers());

it('does not start an operation after its shared deadline has expired', async () => {
    const action = jest.fn();
    await expect(beforeDeadline(action, Date.now() - 1)).resolves.toBeNull();
    expect(action).not.toHaveBeenCalled();
});

it('handles a rejection arriving after the caller has timed out and cleans up timers', async () => {
    jest.useFakeTimers();
    let rejectRequest;
    const pending = beforeDeadline(() => new Promise((_, reject) => {rejectRequest = reject;}), Date.now() + 100);
    await jest.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBeNull();
    rejectRequest(Error('late network failure'));
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(0);
});

const simulation = process.env.MUSICFREE_SIMULATION_URL;
(simulation ? it : it.skip)('moves past a slow real HTTP response without allowing it to overwrite a successful next request', async () => {
    const client = axios.create({proxy: false, timeout: 2000});
    let slowFinished = false;
    const first = beforeDeadline(async () => {
        const result = await client.get(simulation + '/__slow');
        slowFinished = true;
        return result.data;
    }, Date.now() + 50);
    await expect(first).resolves.toBeNull();
    const next = await beforeDeadline(() => client.get(simulation + '/__html'), Date.now() + 1000);
    // A deliberate non-2xx HTTP response is a failed candidate, not a successful source.
    expect(next).toBeNull();
    const successful = await beforeDeadline(() => client.post(simulation + '/__echo', {stage: 'alternate'}), Date.now() + 1000);
    expect(successful.data.body).toEqual({stage: 'alternate'});
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(slowFinished).toBe(true);
    await expect(first).resolves.toBeNull();
});
