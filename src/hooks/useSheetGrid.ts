import { useCallback, useState } from "react";
import { LayoutChangeEvent, useWindowDimensions } from "react-native";
import rpx from "@/utils/rpx";
import { getSheetColumns } from "@/utils/layout";

export default function useSheetGrid() {
    const window = useWindowDimensions();
    const [width, setWidth] = useState(window.width);
    const onLayout = useCallback((event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
    }, []);

    // Leave space around each 210rpx cover, even in a narrow iPad window.
    return { columns: getSheetColumns(width, rpx(250)), onLayout };
}
