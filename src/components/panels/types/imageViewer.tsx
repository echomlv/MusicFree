import React from "react";
import { Image, StyleSheet, useWindowDimensions } from "react-native";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { saveToGallery } from "@/utils/fileUtils.ts";
import { errorLog } from "@/utils/log.ts";
import PanelFullscreen from "@/components/panels/base/panelFullscreen.tsx";
import { Button } from "@/components/base/button.tsx";
import { useI18N } from "@/core/i18n";

interface IImageViewerProps {
    // 图片路径
    url: string;
}

export default function ImageViewer(props: IImageViewerProps) {
    const { url } = props;
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const imageSize = Math.max(0, Math.min(width - insets.left - insets.right - rpx(48), height - insets.top - insets.bottom - rpx(200), 800));
    const { t } = useI18N();

    return (
        <PanelFullscreen
            hasMask
            animationType="Scale"
            containerStyle={styles.container}>
            <Image
                style={{ width: imageSize, height: imageSize, resizeMode: "contain" }}
                source={{
                    uri: url,
                }}
            />
            <Button
                text={t("panel.imageViewer.saveImage")}
                type="primary"
                style={styles.button}
                onPress={() => {
                    saveToGallery(url)
                        .then((resultPath) => {
                            Toast.success(t("panel.imageViewer.saveImageSuccess", {
                                path: resultPath,
                            }));
                        }).catch(e => {
                            errorLog("Save failed", e?.message ?? e);
                            Toast.warn(t("panel.imageViewer.saveImageFail", {
                                reason: e?.message ?? e,
                            }));
                        });
                }}
            />
        </PanelFullscreen>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: "center",
        alignItems: "center",
        gap: rpx(48),
    },
    button: {
        marginHorizontal: rpx(24),
        paddingHorizontal: rpx(48),
        maxWidth: "90%",
    },
});
