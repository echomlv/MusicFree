import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import useLayout from "@/hooks/useLayout";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Background from "./components/background";
import Bottom from "./components/bottom";
import Content from "./components/content";
import Lyric from "./components/content/lyric";
import NavBar from "./components/navBar";
import Config from "@/core/appConfig";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

export default function MusicDetail() {
    const { twoColumns } = useLayout();

    useEffect(() => {
        const needAwake = Config.getConfig("basic.musicDetailAwake");
        if (needAwake) {
            activateKeepAwakeAsync();
        }
        return () => {
            if (needAwake) {
                deactivateKeepAwake();
            }
        };
    }, []);

    return (
        <>
            <Background />
            <SafeAreaView style={globalStyle.fwflex1}>
                <StatusBar backgroundColor={"transparent"} barStyle="light-content" />
                <View style={style.bodyWrapper}>
                    <View style={[style.player, !twoColumns ? style.singleColumn : null]}>
                        <NavBar />
                        <Content />
                        <Bottom />
                    </View>
                    {twoColumns ? (
                        <View style={globalStyle.flex1}>
                            <Lyric />
                        </View>
                    ) : null}
                </View>
            </SafeAreaView>
        </>
    );
}

const style = StyleSheet.create({
    bodyWrapper: {
        width: "100%",
        flex: 1,
        flexDirection: "row",
        maxWidth: 1366,
        alignSelf: "center",
    },
    player: {
        flex: 1,
        minWidth: 0,
    },
    singleColumn: {
        maxWidth: 600,
        marginHorizontal: "auto",
    },
});
