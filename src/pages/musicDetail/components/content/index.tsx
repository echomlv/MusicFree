import React, { useState } from "react";
import { View } from "react-native";
import AlbumCover from "./albumCover";
import Lyric from "./lyric";
import useLayout from "@/hooks/useLayout";
import Config from "@/core/appConfig";
import globalStyle from "@/constants/globalStyle";

export default function Content() {
    const [tab, selectTab] = useState<"album" | "lyric">(
        Config.getConfig("basic.musicDetailDefault") || "album",
    );
    const { twoColumns } = useLayout();
    const showAlbumCover = tab === "album" || twoColumns;

    const onTurnPageClick = () => {
        if (twoColumns) {
            return;
        }
        if (tab === "album") {
            selectTab("lyric");
        } else {
            selectTab("album");
        }
    };

    return (
        <View style={globalStyle.fwflex1}>
            {showAlbumCover ? (
                <AlbumCover onTurnPageClick={onTurnPageClick} />
            ) : (
                <Lyric onTurnPageClick={onTurnPageClick} />
            )}
        </View>
    );
}
