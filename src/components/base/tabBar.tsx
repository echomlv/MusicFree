import React from "react";
import {
    TabBar as NativeTabBar,
    TabBarItem,
    type Route,
    type TabBarItemProps,
    type TabBarProps,
} from "react-native-tab-view";

function renderTabBarItem<T extends Route>({
    key,
    ...props
}: TabBarItemProps<T> & { key: string }) {
    // Tab View 3.x includes key in props; React requires it outside the spread.
    return <TabBarItem key={key} {...props} />;
}

export default function TabBar<T extends Route>(props: TabBarProps<T>) {
    return (
        <NativeTabBar
            {...props}
            renderTabBarItem={props.renderTabBarItem ?? renderTabBarItem}
        />
    );
}
