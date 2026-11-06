import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { fontSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";

import ThemeText from "@/components/base/themeText";
import { ScrollView, TextInput } from "react-native-gesture-handler";
import PanelBase from "../base/panelBase";
import { hidePanel } from "../usePanel";
import PanelHeader from "../base/panelHeader";
import { useI18N } from "@/core/i18n";

interface ISimpleInputProps {
    title?: string;
    onOk: (text: string, closePanel: () => void) => void;
    hints?: string[];
    onCancel?: () => void;
    maxLength?: number;
    placeholder?: string;
    autoFocus?: boolean;
    initialValue?: string;
}

export default function SimpleInput(props: ISimpleInputProps) {
    const { t } = useI18N();
    const {
        onOk,
        onCancel,
        placeholder,
        maxLength = 80,
        hints,
        title,
        autoFocus = true,
    } = props;

    const [input, setInput] = useState(props.initialValue || "");
    const colors = useColors();

    return (
        <PanelBase
            keyboardAvoidBehavior="height"
            height={hints?.length ? "30%" : rpx(260)}
            renderBody={() => (
                <>
                    <PanelHeader
                        title={title || ""}
                        onCancel={() => {
                            onCancel?.();
                            hidePanel();
                        }}
                        onOk={async () => {
                            onOk(input, hidePanel);
                        }}
                    />

                    <TextInput
                        value={input}
                        accessible
                        autoFocus={autoFocus}
                        accessibilityLabel={t("panel.simpleInput.inputLabel")}
                        accessibilityHint={placeholder}
                        onChangeText={_ => {
                            setInput(_);
                        }}
                        style={[
                            style.input,
                            {
                                color: colors.text,
                                backgroundColor: colors.placeholder,
                            },
                        ]}
                        placeholderTextColor={colors.textSecondary}
                        placeholder={placeholder ?? ""}
                        maxLength={maxLength}
                    />
                    {hints?.length ? (
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <View style={style.hints}>
                                {hints.map((_, index) => (
                                    <ThemeText
                                        key={`hint-index-${index}`}
                                        style={style.hintLine}
                                        fontSize="subTitle"
                                        fontColor="textSecondary">
                                        ￮ {_}
                                    </ThemeText>
                                ))}
                            </View>
                        </ScrollView>
                    ) : null}
                </>
            )}
        />
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
    },
    opeartions: {
        width: "100%",
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        height: rpx(100),
        alignItems: "center",
        justifyContent: "space-between",
    },
    input: {
        margin: rpx(24),
        borderRadius: rpx(12),
        fontSize: fontSizeConst.content,
        lineHeight: fontSizeConst.content * 1.5,
        padding: rpx(12),
    },
    hints: {
        marginTop: rpx(24),
        paddingHorizontal: rpx(24),
    },
    hintLine: {
        marginBottom: rpx(12),
    },
});
