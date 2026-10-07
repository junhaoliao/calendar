import {createContext, useContext, useEffect, useMemo, useRef, useState} from "react";
import type {CSSProperties, ReactNode, RefObject} from "react";

interface CalendarStyle {
    theme: "light" | "dark";
    style?: CSSProperties;
    lang: string;
    rootRef?: RefObject<HTMLDivElement | null>;
}

const CalendarStyleContext = createContext<CalendarStyle>({theme: "light", lang: "en"});

export function CalendarStyleProvider({
    theme,
    style,
    lang = "en",
    children,
}: {
    theme?: CalendarStyle["theme"];
    style?: CSSProperties;
    lang?: string;
    children: ReactNode;
}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [ambientTheme, setAmbientTheme] = useState<CalendarStyle["theme"]>("light");
    useEffect(() => {
        if (theme) return;
        const ancestors: HTMLElement[] = [];
        for (let node = rootRef.current; node; node = node.parentElement as HTMLDivElement | null) {
            ancestors.push(node);
        }
        const refresh = () => {
            const nearest = ancestors.find(
                (node) => node.classList.contains("dark") || node.classList.contains("light"),
            );
            setAmbientTheme(nearest?.classList.contains("dark") ? "dark" : "light");
        };
        refresh();
        const observer = new MutationObserver(refresh);
        for (const node of ancestors) observer.observe(node, {attributes: true, attributeFilter: ["class"]});
        return () => observer.disconnect();
    }, [theme]);
    const variables = Object.entries(style ?? {})
        .filter(([key]) => key.startsWith("--"))
        .sort(([left], [right]) => left.localeCompare(right));
    const variablesKey = JSON.stringify(variables);
    const value = useMemo(
        () => ({
            theme: theme ?? ambientTheme,
            lang,
            // Root layout must not leak into detached overlays or event cards.
            style: Object.fromEntries(JSON.parse(variablesKey)) as CSSProperties,
            rootRef,
        }),
        [theme, ambientTheme, lang, variablesKey],
    );
    return <CalendarStyleContext.Provider value={value}>{children}</CalendarStyleContext.Provider>;
}

export function useCalendarStyle() {
    const {rootRef, theme, style, lang} = useContext(CalendarStyleContext);
    return {
        rootRef,
        scopeProps: {
            "data-event-calendar-scope": "",
            "data-event-calendar-theme": theme,
            lang,
            style,
        },
    };
}
