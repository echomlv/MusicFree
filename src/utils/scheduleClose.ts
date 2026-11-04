import TrackPlayer from "@/core/trackPlayer";
import { getDefaultStore, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import BackgroundTimer from "react-native-background-timer";
import { closeAfterPlayEndAtom, consumeSleepTimer, deadlineAtom } from "./sleepTimerState";


let timerId: any;


function setScheduleClose(deadline: number | null) {
    getDefaultStore().set(deadlineAtom, deadline);
    timerId && BackgroundTimer.clearTimeout(timerId);
    if (deadline && deadline > Date.now()) {
        timerId = BackgroundTimer.setTimeout(async () => {
            if (consumeSleepTimer()) {
                await TrackPlayer.reset();
            }

        }, deadline - Date.now());
    } else {
        if (timerId) {
            BackgroundTimer.clearTimeout(timerId);
        }
        timerId = null;
    }
}

function setCloseAfterPlayEnd(closeAfterPlayEnd: boolean) {
    getDefaultStore().set(closeAfterPlayEndAtom, closeAfterPlayEnd);
    if (consumeSleepTimer()) void TrackPlayer.reset();
}

function useScheduleCloseCountDown() {
    const deadline = useAtomValue(deadlineAtom);

    const [countDown, setCountDown] = useState(
        deadline ? deadline - Date.now() : null);

    const intervalRef = useRef<any>();

    useEffect(() => {
        // deadline改变时，更新定时器
        // 清除原有的定时器
        intervalRef.current && clearInterval(intervalRef.current);
        intervalRef.current = null;

        // 清空定时
        if (!deadline || deadline <= Date.now()) {
            setCountDown(null);
            return;
        } else {
            // 更新倒计时
            setCountDown(Math.max(deadline - Date.now(), 0) / 1000);
            intervalRef.current = setInterval(() => {
                setCountDown(Math.max(deadline - Date.now(), 0) / 1000);
            }, 1000);
        }

        return () => {
            // 清除定时器
            intervalRef.current && clearInterval(intervalRef.current);
            intervalRef.current = null;
        };
    }, [deadline]);

    return countDown;
}


const useCloseAfterPlayEnd = () => useAtomValue(closeAfterPlayEndAtom);


export { setScheduleClose, useScheduleCloseCountDown, setCloseAfterPlayEnd, useCloseAfterPlayEnd };
