// src/lib/error.ts
import axios from "axios";

export function errMsg(e: unknown, fallback = "เกิดข้อผิดพลาด") {
    // AxiosError
    if (axios.isAxiosError(e)) {
        const m =
            (e.response?.data )?.message ||
            (e.response?.data )?.error ||
            e.message;
        return m || fallback;
    }
    // Error ทั่วไป
    if (e instanceof Error) return e.message || fallback;
    try {
        if (typeof e === "string") return e;
        return JSON.stringify(e) || fallback;
    } catch {
        return fallback;
    }
}
