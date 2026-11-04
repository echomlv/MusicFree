import React from "react";

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PluginList from "./views/pluginList";
import PluginSort from "./views/pluginSort";
import PluginSubscribe from "./views/pluginSubscribe";
import PageContainer from "@/components/base/pageContainer";
import useColors from "@/hooks/useColors";

const Stack = createNativeStackNavigator<any>();

const routes = [
    {
        path: "/pluginsetting/list",
        component: PluginList,
    },
    {
        path: "/pluginsetting/sort",
        component: PluginSort,
    },
    {
        path: "/pluginsetting/subscribe",
        component: PluginSubscribe,
    },
];

export default function PluginSetting() {
    const colors = useColors();
    return (
        <Stack.Navigator
            initialRouteName={routes[0].path}
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
                animationDuration: 100,
                contentStyle: {
                    backgroundColor: colors.background,
                },
            }}>
            {routes.map(route => (
                <Stack.Screen
                    key={route.path}
                    name={route.path}>
                    {() => (
                        <PageContainer>
                            <route.component />
                        </PageContainer>
                    )}
                </Stack.Screen>
            ))}
        </Stack.Navigator>
    );
}
