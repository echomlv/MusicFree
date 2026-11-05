jest.mock('react-native-reanimated', () => ({Easing: {out: value => value, exp: () => 0}}));
jest.mock('@/utils/mediaUtils', () => ({isSameMediaItem: (a, b) => String(a?.id) === String(b?.id) && a?.platform === b?.platform}));
const SortedMusicList = require('../sortedMusicList').default;
it('deduplicates both existing songs and duplicates in a single imported batch', () => {
    const song = {id: '1', platform: 'one', title: 'A'};
    const other = {id: '2', platform: 'one', title: 'B'};
    const list = new SortedMusicList([song]);
    expect(list.add([song, other, {...other, id: 2}, {...other, platform: 'two'}])).toBe(2);
    expect(list.musicList).toHaveLength(3);
});
