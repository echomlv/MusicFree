import { useWindowDimensions } from "react-native";

export default function useOrientation() {
    const { width, height } = useWindowDimensions();
    return width < height ? "vertical" : "horizontal";
}
