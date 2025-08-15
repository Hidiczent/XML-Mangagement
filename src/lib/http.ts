export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function http<T>(url: string, init?: RequestInit) {
    const res = await fetch(API_BASE + url, {
        headers: { "Content-Type": "application/json" },
        ...init,
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
}
