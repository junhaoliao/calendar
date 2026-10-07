import type {Locale} from "date-fns";
import {enUS} from "date-fns/locale/en-US";
import {fr} from "date-fns/locale/fr";
import {zhCN} from "date-fns/locale/zh-CN";
import {zhHK} from "date-fns/locale/zh-HK";

const DATE_LOCALES: Record<string, Locale> = {
    en: enUS,
    fr,
    "zh-Hans": zhCN,
    "zh-Hant": zhHK,
};

/** Public script tags map to date-fns' internal regional adapters. */
const dateLocaleFor = (language: string): Locale => DATE_LOCALES[language] ?? enUS;

export {dateLocaleFor};
