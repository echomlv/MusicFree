import React from "react";
import { StatusBar, StatusBarProps, View } from "react-native";
import useColors from "@/hooks/useColors";
import Color from "color";
import { useIsFocused } from "@react-navigation/native";

interface IStatusBarProps extends StatusBarProps {}

export default function (props: IStatusBarProps) {
    const colors = useColors();
    const { backgroundColor, barStyle } = props;
    const focused = useIsFocused();
    const pageColor = colors.pageBackground ?? colors.background;

    return (
        <>
            {focused && <StatusBar
                backgroundColor={"rgba(0,0,0,0)"}
                barStyle={barStyle ?? (Color(pageColor).isLight() ? "dark-content" : "light-content")}
            />}
            <View
                style={{
                    zIndex: 10000,
                    position: "absolute",
                    top: 0,
                    backgroundColor:
                        backgroundColor ?? colors.appBar ?? colors.primary,
                    width: "100%",
                    height: StatusBar.currentHeight,
                }}
            />
        </>
    );
}
