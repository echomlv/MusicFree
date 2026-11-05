/** Bound the caller's wait; plugins do not expose a request cancellation API. */
export async function beforeDeadline<T>(
    action: () => Promise<T>,
    deadline: number,
): Promise<T | null> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            Promise.resolve().then(action).catch(() => null),
            new Promise<null>(resolve => {
                timer = setTimeout(() => resolve(null), remaining); 
            }),
        ]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}
