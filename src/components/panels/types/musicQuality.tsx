import React, { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";

import { qualityKeys, qualityText } from "@/utils/qualities";
import { sizeFormatter } from "@/utils/fileUtils";
import PanelBase from "../base/panelBase";
import { ScrollView } from "react-native-gesture-handler";
import { hidePanel } from "../usePanel";
import Divider from "@/components/base/divider";
import PanelHeader from "../base/panelHeader";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import Icon from "@/components/base/icon";
import { useMusicQuality } from "@/core/trackPlayer";

interface IMusicQualityProps {
    type?: "play" | "download";
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
    /** 点击回调 */
    onQualityPress: (
        quality: IMusic.IQualityKey,
        musicItem: IMusic.IMusicItem,
    ) => void;
}

export default function MusicQuality(props: IMusicQualityProps) {
    const i18n = useI18N();
    const colors = useColors();
    const currentQuality = useMusicQuality();

    const { musicItem, onQualityPress, type = "play" } = props ?? {};

    return (
        <PanelBase
            height={rpx(520)}
            keyboardAvoidBehavior="none"
            renderBody={() => (
                <>
                    <PanelHeader
                        title={i18n.t("panel.musicQuality.title", {
                            type:
                                type === "play"
                                    ? i18n.t("common.play")
                                    : i18n.t("common.download"),
                        })}
                        hideButtons
                    />
                    <Divider />

                    <ScrollView
                        style={[
                            style.body,
                            { backgroundColor: colors.backdrop },
                        ]}>
                        {qualityKeys.map(key => {
                            return (
                                <Fragment key={`frag-${key}`}>
                                    <Pressable
                                        key={`btn-${key}`}
                                        style={({ pressed }) => [
                                            style.item,
                                            pressed ? { backgroundColor: colors.listActive } : null,
                                        ]}
                                        onPress={() => {
                                            onQualityPress(key, musicItem);
                                            hidePanel();
                                        }}>
                                        <View style={style.itemContent}>
                                            <ThemeText
                                                fontColor={type === "play" && currentQuality === key ? "primary" : "text"}
                                                fontWeight={type === "play" && currentQuality === key ? "medium" : "regular"}>
                                                {qualityText[key]}{" "}
                                                {musicItem.qualities?.[key]?.size
                                                    ? `(${sizeFormatter(
                                                          musicItem.qualities[key]
                                                              .size!,
                                                    )})`
                                                    : ""}
                                            </ThemeText>
                                            {type === "play" && currentQuality === key ? (
                                                <Icon name="check-circle" color={colors.primary} size={rpx(36)} />
                                            ) : null}
                                        </View>
                                    </Pressable>
                                </Fragment>
                            );
                        })}
                    </ScrollView>
                </>
            )}
        />
    );
}

const style = StyleSheet.create({
    header: {
        width: "100%",
        flexDirection: "row",
        padding: rpx(24),
    },
    body: {
        flex: 1,
        paddingHorizontal: rpx(24),
    },
    item: {
        height: rpx(96),
        justifyContent: "center",
    },
    itemContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: rpx(8),
    },
});
