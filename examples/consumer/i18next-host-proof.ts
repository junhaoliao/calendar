import {useTranslation} from "react-i18next";

/** Included by the fresh consumer's tsc command, proving host keys remain independent. */
export const useHostTranslationProof = () => {
    const {t} = useTranslation("host");
    const hello: string = t("hello");
    // @ts-expect-error a missing host key must be rejected by the host's augmentation
    t("doesNotExist");
    return hello;
};
