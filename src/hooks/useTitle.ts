import { useEffect } from "react";

export default function useTitle(title: string) {
    useEffect(() => {
        const prev = document.title;
        document.title = `${title} | MyReactApp`;
        return () => { document.title = prev; };
    }, [title]);
}
