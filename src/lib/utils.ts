import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";

/**
 * Combines class names and resolves Tailwind utility conflicts.
 *
 * @param inputs Class values to merge.
 * @return The merged class name string.
 */
const cn = (...inputs: ClassValue[]) => {
    return twMerge(clsx(inputs));
};

export {cn};
