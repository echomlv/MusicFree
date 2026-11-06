// Layout follows the available window, including Split View and Stage Manager.
export const WIDE_LAYOUT_WIDTH = 700;
export const MAX_CONTROL_WIDTH = 440;

export function getControlScale(width: number, height: number) {
    return Math.min(width, height, MAX_CONTROL_WIDTH) / 750;
}

export function getSheetColumns(width: number, minimumCellWidth: number) {
    return Math.max(1, Math.floor(width / minimumCellWidth));
}

export function getPanelWidth(width: number, height: number) {
    return Math.min(width, height, 750);
}

export function hasTwoColumns(width: number, height: number) {
    return width >= WIDE_LAYOUT_WIDTH || width > height;
}
