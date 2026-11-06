import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import FastImage from "@/components/base/fastImage";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import Divider from "@/components/base/divider";
import { IIconName } from "@/components/base/icon";
import { ImgAsset } from "@/constants/assetsConst";
import { iconSizeConst } from "@/constants/uiConst";
import rpx from "@/utils/rpx";
import PanelBase from "./panelBase";

interface MusicOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
    show?: boolean;
}

const ROW_HEIGHT = rpx(84);
const HEADER_HEIGHT = rpx(160);
const LIST_PADDING = rpx(12);

export default function MusicOptionsPanel({ musicItem, options }: {
    musicItem: IMusic.IMusicItem;
    options: MusicOption[];
}) {
    // Filter before measuring: hidden album/download actions must not occupy list rows.
    const visibleOptions = options.filter(option => option.show !== false);
    const window = useWindowDimensions();
    const height = Math.min(
        window.height * 0.75,
        HEADER_HEIGHT + visibleOptions.length * ROW_HEIGHT + LIST_PADDING * 2 + StyleSheet.hairlineWidth,
    );

    return (
        <PanelBase
            height={height}
            keyboardAvoidBehavior="none"
            renderBody={() => (
                <>
                    <View style={styles.header}>
                        <FastImage
                            style={styles.artwork}
                            source={musicItem.artwork}
                            placeholderSource={ImgAsset.albumDefault}
                        />
                        <View style={styles.content}>
                            <ThemeText numberOfLines={2}>{musicItem.title}</ThemeText>
                            <ThemeText fontColor="textSecondary" fontSize="description" numberOfLines={2}>
                                {musicItem.artist}{musicItem.album ? ` - ${musicItem.album}` : ""}
                            </ThemeText>
                        </View>
                    </View>
                    <Divider />
                    <FlatList
                        style={styles.list}
                        data={visibleOptions}
                        contentContainerStyle={styles.listContent}
                        keyExtractor={option => option.title}
                        getItemLayout={(_, index) => ({
                            length: ROW_HEIGHT,
                            offset: LIST_PADDING + ROW_HEIGHT * index,
                            index,
                        })}
                        renderItem={({ item }) => (
                            <ListItem withHorizontalPadding style={styles.row} onPress={item.onPress}>
                                <ListItem.ListItemIcon width={rpx(48)} icon={item.icon} iconSize={iconSizeConst.light} />
                                <ListItem.Content title={item.title} />
                            </ListItem>
                        )}
                    />
                </>
            )}
        />
    );
}

const styles = StyleSheet.create({
    header: {
        height: HEADER_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        padding: rpx(24),
    },
    artwork: {
        width: rpx(112),
        height: rpx(112),
        borderRadius: rpx(12),
    },
    content: {
        flex: 1,
        marginLeft: rpx(24),
        gap: rpx(12),
    },
    list: { flex: 1 },
    listContent: { paddingVertical: LIST_PADDING },
    row: { height: ROW_HEIGHT },
});
