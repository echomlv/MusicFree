import React, { useState } from "react";
import rpx from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";
import FastImage from "@/components/base/fastImage";
import useLayout from "@/hooks/useLayout";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCurrentMusic } from "@/core/trackPlayer";
import globalStyle from "@/constants/globalStyle";
import { View } from "react-native";
import Operations from "./operations";
import { showPanel } from "@/components/panels/usePanel.ts";

interface IProps {
    onTurnPageClick?: () => void;
}

export default function AlbumCover(props: IProps) {
    const { onTurnPageClick } = props;

    const musicItem = useCurrentMusic();
    const { width, height, compactHeight } = useLayout();
    const [availableSize, setAvailableSize] = useState(rpx(500));
    const preferredSize = Math.min(width, height) >= 600
        ? 420
        : rpx(compactHeight ? 260 : 500);
    const artworkSize = Math.min(preferredSize, availableSize);

    const longPress = Gesture.LongPress()
        .onStart(() => {
            if (musicItem?.artwork) {
                showPanel("ImageViewer", {
                    url: musicItem.artwork,
                });
            }
        })
        .runOnJS(true);

    const tap = Gesture.Tap()
        .onStart(() => {
            onTurnPageClick?.();
        })
        .runOnJS(true);

    const combineGesture = Gesture.Race(tap, longPress);

    return (
        <>
            <GestureDetector gesture={combineGesture}>
                <View
                    style={globalStyle.fullCenter}
                    onLayout={event => {
                        const layout = event.nativeEvent.layout;
                        setAvailableSize(Math.max(0, Math.min(layout.width * 0.84, layout.height - rpx(24))));
                    }}>
                    <FastImage
                        style={{ width: artworkSize, height: artworkSize }}
                        source={musicItem?.artwork}
                        placeholderSource={ImgAsset.albumDefault}
                    />
                </View>
            </GestureDetector>
            <Operations />
        </>
    );
}
