import { useEffect } from "react";

export default function useTitle(title: string) {
    useEffect(() => {
        const prev = document.title;
        document.title = `${title} | XML`;
        return () => { document.title = prev; };
    }, [title]);
}
