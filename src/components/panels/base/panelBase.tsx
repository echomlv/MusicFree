import useColors from "@/hooks/useColors";
import useOrientation from "@/hooks/useOrientation";
import rpx, { vh } from "@/utils/rpx";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BackHandler,
    DeviceEventEmitter,
    Keyboard,
    KeyboardAvoidingView,
    NativeEventSubscription,
    Platform,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
} from "react-native";
import Animated, {
    Easing,
    EasingFunction,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { panelInfoStore } from "../usePanel";

const ANIMATION_EASING: EasingFunction = Easing.out(Easing.exp);
const ANIMATION_DURATION = 250;

const timingConfig = {
    duration: ANIMATION_DURATION,
    easing: ANIMATION_EASING,
};

interface IPanelBaseProps {
    keyboardAvoidBehavior?: "height" | "padding" | "position" | "none";
    height?: number;
    renderBody: (loading: boolean) => JSX.Element;
}

export default function (props: IPanelBaseProps) {
    const {
        height = vh(60),
        renderBody,
        keyboardAvoidBehavior,
    } = props;
    const snapPoint = useSharedValue(0);

    const colors = useColors();
    const [loading, setLoading] = useState(true); // 是否处于弹出状态
    const timerRef = useRef<any>();
    const safeAreaInsets = useSafeAreaInsets();
    const orientation = useOrientation();
    const window = useWindowDimensions();
    const [availableHeight, setAvailableHeight] = useState(window.height);
    const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
    const avoidsKeyboard = keyboardAvoidBehavior !== "none";
    const bottomInset = avoidsKeyboard && keyboardVisible ? 0 : safeAreaInsets.bottom;
    const maximumHeight = Math.max(0, availableHeight - safeAreaInsets.top);
    // Height describes usable content; safe-area padding stays inside the same surface.
    const panelHeight = orientation === "horizontal"
        ? maximumHeight
        : Math.min(height + bottomInset, maximumHeight);
    const panelWidth = Math.min(rpx(750), window.width);
    const useAnimatedBase = useMemo(
        () => (orientation === "horizontal" ? panelWidth : panelHeight),
        [orientation, panelHeight, panelWidth],
    );

    useEffect(() => {
        const show = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            () => setKeyboardVisible(true),
        );
        const hide = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
            () => setKeyboardVisible(false),
        );
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    const backHandlerRef = useRef<NativeEventSubscription>();

    const hideCallbackRef = useRef<Function[]>([]);

    useEffect(() => {
        snapPoint.value = withTiming(1, timingConfig);

        timerRef.current = setTimeout(() => {
            // Fallback when the animation completion notification is delayed.
            setLoading(false);
        }, 400);
        if (backHandlerRef.current) {
            backHandlerRef.current.remove();
            backHandlerRef.current = undefined;
        }
        backHandlerRef.current = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                Keyboard.dismiss();
                snapPoint.value = withTiming(0, timingConfig);
                return true;
            },
        );

        const listenerSubscription = DeviceEventEmitter.addListener(
            "hidePanel",
            (callback?: () => void) => {
                if (callback) {
                    hideCallbackRef.current.push(callback);
                }
                Keyboard.dismiss();
                snapPoint.value = withTiming(0, timingConfig);
            },
        );

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (backHandlerRef.current) {
                backHandlerRef.current?.remove();
                backHandlerRef.current = undefined;
            }
            listenerSubscription.remove();
        };
    }, [snapPoint]);

    const maskAnimated = useAnimatedStyle(() => {
        return {
            opacity: snapPoint.value * 0.5,
        };
    });

    const panelAnimated = useAnimatedStyle(() => {
        return {
            transform: [
                orientation === "vertical"
                    ? {
                        translateY: (1 - snapPoint.value) * useAnimatedBase,
                    }
                    : {
                        translateX: (1 - snapPoint.value) * useAnimatedBase,
                    },
            ],
        };
    }, [orientation, useAnimatedBase]);

    const mountPanel = useCallback(() => {
        setLoading(false);
    }, []);

    const unmountPanel = useCallback(() => {
        panelInfoStore.setValue({
            name: null,
            payload: null,
        });
        hideCallbackRef.current.forEach(cb => cb?.());
    }, []);

    useAnimatedReaction(
        () => snapPoint.value,
        (result, prevResult) => {
            if (
                ((prevResult !== null && result > prevResult) ||
                    prevResult === null) &&
                result > 0.8
            ) {
                runOnJS(mountPanel)();
            }

            if (prevResult && result < prevResult && result === 0) {
                runOnJS(unmountPanel)();
            }
        },
        [],
    );

    const panelBody = (
        <Animated.View
            collapsable={false}
            testID="bottom-panel"
            style={[
                style.wrapper,
                {
                    width: panelWidth,
                    height: panelHeight,
                    paddingBottom: bottomInset,
                },
                panelAnimated,
            ]}>
            {/* Keep the solid surface separate from the asymmetric corner clip.
                iOS can leave a dark strip when it rasterizes both on one view. */}
            <View
                testID="bottom-panel-surface"
                pointerEvents="none"
                style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.backdrop }]}
            />
            {renderBody(loading)}
        </Animated.View>
    );

    const content = (
        <View
            testID="bottom-panel-container"
            collapsable={false}
            pointerEvents="box-none"
            style={style.contentContainer}
            onLayout={event => {
                const available = event.nativeEvent.layout.height;
                setAvailableHeight(available);
            }}>
            {panelBody}
        </View>
    );

    return (
        <View testID="bottom-panel-overlay" collapsable={false} pointerEvents="box-none" style={style.overlay}>
            <Pressable
                style={style.maskWrapper}
                onPress={() => {
                    Keyboard.dismiss();
                    snapPoint.value = withTiming(0, timingConfig);
                }}>
                <Animated.View
                    style={[style.maskWrapper, style.mask, maskAnimated]}
                />
            </Pressable>
            {avoidsKeyboard ? (
                <KeyboardAvoidingView
                    testID="bottom-panel-keyboard"
                    pointerEvents="box-none"
                    style={style.kbContainer}
                    contentContainerStyle={style.contentContainer}
                    behavior={keyboardAvoidBehavior === "none" ? undefined : keyboardAvoidBehavior || "height"}>
                    {content}
                </KeyboardAvoidingView>
            ) : content}
        </View>
    );
}

const style = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 15000,
    },
    maskWrapper: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    mask: {
        backgroundColor: "#000",
        opacity: 0.5,
    },
    wrapper: {
        borderTopLeftRadius: rpx(28),
        borderTopRightRadius: rpx(28),
        overflow: "hidden",
        zIndex: 1,
    },
    kbContainer: {
        flex: 1,
        zIndex: 1,
    },
    contentContainer: {
        flex: 1,
        justifyContent: "flex-end",
        alignItems: "flex-end",
        zIndex: 1,
    },
});
