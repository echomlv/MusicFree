import React, { PropsWithChildren } from "react";
import { View } from "react-native";
import globalStyle from "@/constants/globalStyle";
import PageBackground from "./pageBackground";

export default function PageContainer({ children }: PropsWithChildren) {
    return (
        <View style={globalStyle.flex1}>
            <PageBackground />
            {children}
        </View>
    );
}
