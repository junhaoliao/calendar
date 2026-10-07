import {vi} from "vitest";

type MediaQueryChangeListener = EventListener;

type MockMediaQueryList = MediaQueryList & {
    emitChange: () => void;
    listenerCount: () => number;
    setMatches: (matches: boolean) => void;
};

const mediaQueryLists = new Map<string, MockMediaQueryList>();

/**
 * Creates a media query list mock with change listener support.
 *
 * @param query Query controlled by the mock instance.
 * @return Mutable media query object with listener inspection helpers.
 */
const createMockMediaQueryList = (query: string): MockMediaQueryList => {
    let matches = false;
    const listeners = new Set<MediaQueryChangeListener>();

    const dispatchEvent = (event: Event) => {
        for (const listener of listeners) {
            listener(event);
        }

        return true;
    };

    return {
        addEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
            if (type === "change" && typeof listener === "function") {
                listeners.add(listener);
            }
        },
        addListener: () => null,
        dispatchEvent: dispatchEvent,
        emitChange: () => {
            dispatchEvent(new Event("change"));
        },
        listenerCount: () => listeners.size,

        /**
         * Gets current media query match state.
         *
         * @return Whether the query currently matches.
         */
        get matches() {
            return matches;
        },
        media: query,
        onchange: null,
        removeEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
            if (type === "change" && typeof listener === "function") {
                listeners.delete(listener);
            }
        },
        removeListener: () => null,
        setMatches: (nextMatches) => {
            matches = nextMatches;
        },
    };
};

const getMockMediaQueryList = (query: string): MockMediaQueryList => {
    const mediaQueryList = mediaQueryLists.get(query) ?? createMockMediaQueryList(query);

    mediaQueryLists.set(query, mediaQueryList);

    return mediaQueryList;
};
const resetMatchMediaMock = () => {
    mediaQueryLists.clear();
    vi.mocked(window.matchMedia).mockClear();
};
const installMatchMediaMock = () => {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: vi.fn((query: string) => getMockMediaQueryList(query)),
        writable: true,
    });
};

export {getMockMediaQueryList, installMatchMediaMock, resetMatchMediaMock};
