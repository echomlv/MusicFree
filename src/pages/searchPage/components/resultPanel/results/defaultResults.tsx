import React from "react";
import { StyleSheet, Text, View } from "react-native";
import i18n from "@/core/i18n";

export default function DefaultResults() {
    return (
        <View style={style.wrapper}>
            <Text>{i18n.t("searchPage.comingSoon")}</Text>
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
    },
});
