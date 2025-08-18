// src/lib/error.ts
import axios from "axios";

export function errMsg(e: unknown, fallback = "เกิดข้อผิดพลาด") {
    // AxiosError
    if (axios.isAxiosError(e)) {
        // ลองดู message จาก payload ก่อน
        const m =
            (e.response?.data as any)?.message ||
            (e.response?.data as any)?.error ||
            e.message;
        return m || fallback;
    }
    // Error ทั่วไป
    if (e instanceof Error) return e.message || fallback;
    // กรณีเป็น string / object แปลกๆ
    try {
        if (typeof e === "string") return e;
        return JSON.stringify(e) || fallback;
    } catch {
        return fallback;
    }
}
