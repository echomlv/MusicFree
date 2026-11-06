import { Dimensions } from "react-native";
import { getControlScale } from "./layout";

const screen = Dimensions.get("screen");
// Keep controls stable across rotation/resizing. Large screens gain content
// space rather than scaling every icon and row to the full iPad width.
// Use the display so launching in Split View has the same scale as resizing
// into Split View later. Container widths are measured separately.
const controlScale = getControlScale(screen.width, screen.height);

export default function (rpx: number) {
    return rpx * controlScale;
}

export function vh(pct: number) {
    return (pct / 100) * Dimensions.get("window").height;
}

export function vw(pct: number) {
    return (pct / 100) * Dimensions.get("window").width;
}

export function vmin(pct: number) {
    const { width, height } = Dimensions.get("window");
    return (pct / 100) * Math.min(width, height);
}

export function vmax(pct: number) {
    const { width, height } = Dimensions.get("window");
    return (pct / 100) * Math.max(width, height);
}

export function sh(pct: number) {
    return (pct / 100) * Dimensions.get("screen").height;
}

export function sw(pct: number) {
    return (pct / 100) * Dimensions.get("screen").width;
}
