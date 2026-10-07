import {useEffect, useState} from "react";
import type {ReactNode} from "react";
import {I18nextProvider} from "react-i18next";

import {createCalendarI18n} from "./index";
import {DEFAULT_LOCALE} from "./locales";
import type {CalendarLocale} from "./locales";

/** One private synchronous resource store per calendar mount. */
const CalendarI18nProvider = ({locale, children}: {locale?: CalendarLocale; children: ReactNode}) => {
    const language = locale ?? DEFAULT_LOCALE;
    const [instance] = useState(() => createCalendarI18n(language));
    useEffect(() => {
        if (instance.language !== language) void instance.changeLanguage(language);
    }, [instance, language]);
    return (
        <I18nextProvider i18n={instance} defaultNS="calendar">
            {children}
        </I18nextProvider>
    );
};

export {CalendarI18nProvider};
