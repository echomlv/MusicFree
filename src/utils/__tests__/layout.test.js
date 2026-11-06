const { getControlScale, getSheetColumns, hasTwoColumns } = require('../layout');

it.each([[393, 852], [852, 393], [375, 667], [440, 956]])('preserves phone control sizes at %s × %s', (width, height) => {
    expect(getControlScale(width, height)).toBe(Math.min(width, height) / 750);
});

it.each([[744, 1133], [1133, 744], [1032, 1376], [1376, 1032]])('caps control sizes while using two columns at %s × %s', (width, height) => {
    expect(getControlScale(width, height)).toBe(440 / 750);
    expect(hasTwoColumns(width, height)).toBe(true);
});

it('returns to one column in narrow iPad windows', () => {
    expect(hasTwoColumns(375, 1032)).toBe(false);
    expect(hasTwoColumns(600, 1032)).toBe(false);
});

it('fits grid covers within the measured container, including narrow Split View', () => {
    const cellWidth = 250 * getControlScale(744, 1133);
    expect([320, 375, 744, 1032, 1376].map(width => getSheetColumns(width, cellWidth))).toEqual([2, 2, 5, 7, 9]);
    expect(getSheetColumns(0, cellWidth)).toBe(1);
    expect(getSheetColumns(393, 250 * getControlScale(393, 852))).toBe(3);
});
