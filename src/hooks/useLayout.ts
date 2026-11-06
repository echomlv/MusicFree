import { useWindowDimensions } from "react-native";
import { hasTwoColumns } from "@/utils/layout";

export default function useLayout() {
    const { width, height } = useWindowDimensions();
    return {
        width,
        height,
        twoColumns: hasTwoColumns(width, height),
        compactHeight: height < 500,
    };
}
