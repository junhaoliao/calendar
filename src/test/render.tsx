import {StrictMode} from "react";
import type {ReactElement} from "react";

import {render} from "@testing-library/react";
import type {RenderOptions} from "@testing-library/react";

/**
 * Renders under StrictMode so effect cleanup bugs surface in unit tests.
 */
const renderStrict = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
    render(ui, {...options, wrapper: StrictMode});

export {renderStrict};
