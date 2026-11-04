import { Dimensions, NativeModule, NativeModules, Platform } from "react-native";

interface INativeUtils extends NativeModule {
    exitApp: () => void;
    checkStoragePermission: () => Promise<boolean>;
    requestStoragePermission: () => void;
    getWindowDimensions: () => { width: number, height: number }; // Fix bug: https://github.com/facebook/react-native/issues/47080
}

const NativeUtils: INativeUtils = Platform.OS === "ios" ? {
    // iOS apps stop playback rather than terminating their own process.
    exitApp: () => {},
    checkStoragePermission: async () => true,
    requestStoragePermission: () => {},
    getWindowDimensions: () => Dimensions.get("window"),
} : NativeModules.NativeUtils;

export default NativeUtils as INativeUtils;
