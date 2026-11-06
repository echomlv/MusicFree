import React, { useEffect, useRef, useState } from "react";
import { Image as NativeImage, ImageProps, ImageRequireSource } from "react-native";
import FastImage, { FastImageProps } from "react-native-fast-image";

interface IFastImageProps {
    style: FastImageProps["style"];
    defaultSource?: FastImageProps["defaultSource"];
    placeholderSource?: ImageRequireSource;
    source?: FastImageProps["source"] | string;
}
export default function (props: IFastImageProps) {
    const { style, placeholderSource, defaultSource, source } = props ?? {};
    const nativeStyle = style as ImageProps["style"];
    const remote = typeof source === "string" ? { uri: source.trim() } :
        source && typeof source === "object" ? { ...source, uri: source.uri?.trim() } : undefined;
    const uri = remote?.uri || "";
    const key = JSON.stringify([uri, Object.entries(remote?.headers || {}).sort()]);
    const activeKey = useRef(key);
    activeKey.current = key;
    const warnedKey = useRef<string>();
    const [failure, setFailure] = useState<{ key: string; phase: 1 | 2 } | null>(null);
    const phase = failure?.key === key ? failure.phase : 0;
    useEffect(() => {
        setFailure(null); warnedKey.current = undefined;
    }, [key]);
    const fail = (next: 1 | 2) => {
        if (activeKey.current !== key) return;
        setFailure(previous => previous?.key === key && previous.phase >= next ? previous : { key, phase: next });
    };
    if (!uri || phase === 2) {
        const local = typeof source === "number" ? source : placeholderSource;
        return <NativeImage style={nativeStyle} source={local} defaultSource={defaultSource} />;
    }
    if (phase === 1) {
        return <NativeImage
            style={nativeStyle}
            source={{ uri, headers: remote?.headers }}
            defaultSource={defaultSource || placeholderSource}
            onError={event => {
                if (activeKey.current !== key) return;
                fail(2);
                if (warnedKey.current === key) return;
                warnedKey.current = key;
                console.warn("Image load failed after native fallback:", {
                    uri: uri.replace(/[?#].*$/, ""),
                    error: String(event.nativeEvent?.error || "Native image request failed").replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, "$1?..."),
                });
            }}
        />;
    }
    return (
        <FastImage
            style={style}
            source={remote}
            onError={() => fail(1)}
            defaultSource={defaultSource}
        />
    );
}
