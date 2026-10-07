import {createRef} from "react";

import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it} from "vitest";

import {Button} from "./button";
import {Popover, PopoverContent, PopoverTrigger} from "./popover";

describe("Button ref composition", () => {
    it("forwards the trigger DOM ref, opens its popover, and restores focus on close", async () => {
        const user = userEvent.setup();
        const triggerRef = createRef<HTMLElement>();
        render(
            <Popover>
                <PopoverTrigger
                    render={
                        <Button ref={triggerRef} variant="outline">
                            Open details
                        </Button>
                    }
                />
                <PopoverContent>Popover details</PopoverContent>
            </Popover>,
        );

        const trigger = screen.getByRole("button", {name: "Open details"});
        expect(triggerRef.current).toBe(trigger);

        await user.click(trigger);
        const popup = await screen.findByRole("dialog");
        expect(popup).toBeVisible();
        expect(within(popup).getByText("Popover details")).toBeVisible();

        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
    });
});
