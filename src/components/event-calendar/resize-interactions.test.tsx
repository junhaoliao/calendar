import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";
import {EventCalendar} from "../../index";
import {renderStrict} from "../../test/render";

const date = new Date(2026, 9, 4, 9);
const event = {
    id: "a:b|c]",
    title: "Meeting",
    start: date,
    end: new Date(2026, 9, 4, 10, 37),
    metadata: {source: "host"},
};

describe("keyboard endpoint controls", () => {
    it("previews the changed endpoint, commits once and preserves consumer metadata", async () => {
        const user = userEvent.setup();
        const update = vi.fn();
        const notify = vi.fn();
        render(
            <EventCalendar
                events={[event]}
                now={date}
                initialDate={date}
                initialView="day"
                onEventUpdate={update}
                onNotification={notify}
            />,
        );
        screen.getByRole("button", {name: "Adjust start of Meeting"}).focus();
        await user.keyboard("{ArrowDown}");
        expect(update).not.toHaveBeenCalled();
        expect(screen.getByRole("button", {name: /Meeting, 9:15am - 10:37am/})).toBeInTheDocument();
        await user.keyboard("{Enter}");
        expect(update).toHaveBeenCalledTimes(1);
        expect(update.mock.calls[0][0].start).toEqual(new Date(2026, 9, 4, 9, 15));
        expect(update.mock.calls[0][0].end).toBe(event.end);
        expect(update.mock.calls[0][0].metadata).toBe(event.metadata);
        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "resized",
                event: expect.objectContaining({id: event.id}),
            }),
        );
    });
    it("Escape discards the candidate and does not open an editor", async () => {
        const user = userEvent.setup();
        const update = vi.fn();
        render(
            <EventCalendar events={[event]} now={date} initialDate={date} initialView="day" onEventUpdate={update} />,
        );
        screen.getByRole("button", {name: "Adjust end of Meeting"}).focus();
        await user.keyboard(" {ArrowDown}{Escape}");
        await waitFor(() => expect(screen.queryByText(/Resizing Meeting:/)).not.toBeInTheDocument());
        expect(update).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("omits controls in readOnly", () => {
        render(<EventCalendar readOnly events={[event]} now={date} initialDate={date} initialView="day" />);
        expect(screen.queryByRole("button", {name: /Adjust/})).not.toBeInTheDocument();
    });
    it("short events have no handles and open the editor instead", async () => {
        const user = userEvent.setup();
        render(
            <EventCalendar
                events={[{...event, end: new Date(2026, 9, 4, 9, 15)}]}
                now={date}
                initialDate={date}
                initialView="day"
            />,
        );
        expect(screen.queryByRole("button", {name: /Adjust/})).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", {name: /^Meeting, /}));
        expect(await screen.findByRole("heading", {name: "Edit Event"})).toBeVisible();
    });
    it("Tab cancels a keyboard resize", async () => {
        const user = userEvent.setup();
        const onEventUpdate = vi.fn();
        render(
            <EventCalendar
                events={[event]}
                now={date}
                initialDate={date}
                initialView="day"
                onEventUpdate={onEventUpdate}
            />,
        );

        screen.getByRole("button", {name: "Adjust end of Meeting"}).focus();
        await user.keyboard("{ArrowDown}{Tab}");

        await waitFor(() => expect(screen.queryByText(/Resizing Meeting:/)).not.toBeInTheDocument());
        expect(onEventUpdate).not.toHaveBeenCalled();
    });
    it("navigation and readOnly changes cancel an active resize", async () => {
        const user = userEvent.setup();
        const onEventUpdate = vi.fn();
        const {rerender} = renderStrict(
            <EventCalendar events={[event]} now={date} date={date} view="day" onEventUpdate={onEventUpdate} />,
        );

        screen.getByRole("button", {name: "Adjust end of Meeting"}).focus();
        await user.keyboard("{ArrowDown}");
        expect(screen.getByText(/Resizing Meeting:/)).toBeInTheDocument();
        rerender(<EventCalendar events={[event]} now={date} date={date} view="week" onEventUpdate={onEventUpdate} />);
        await waitFor(() => expect(screen.queryByText(/Resizing Meeting:/)).not.toBeInTheDocument());
        expect(onEventUpdate).not.toHaveBeenCalled();

        rerender(<EventCalendar events={[event]} now={date} date={date} view="day" onEventUpdate={onEventUpdate} />);
        screen.getByRole("button", {name: "Adjust end of Meeting"}).focus();
        await user.keyboard("{ArrowDown}");
        expect(screen.getByText(/Resizing Meeting:/)).toBeInTheDocument();
        rerender(
            <EventCalendar events={[event]} now={date} date={date} view="day" readOnly onEventUpdate={onEventUpdate} />,
        );
        await waitFor(() => expect(screen.queryByText(/Resizing Meeting:/)).not.toBeInTheDocument());
        expect(onEventUpdate).not.toHaveBeenCalled();
    });
    it("week keyboard resize may end exactly at midnight but cannot advance beyond the visible range", async () => {
        const user = userEvent.setup();
        const onEventUpdate = vi.fn();
        const late = {
            ...event,
            end: new Date(2026, 9, 10, 23, 45),
            id: "late",
            start: new Date(2026, 9, 10, 22),
            title: "Late",
        };
        render(
            <EventCalendar
                events={[late]}
                now={date}
                initialDate={date}
                initialView="week"
                onEventUpdate={onEventUpdate}
            />,
        );

        screen.getByRole("button", {name: "Adjust end of Late"}).focus();
        await user.keyboard("{ArrowDown}{ArrowDown}");
        expect(screen.getByText("Resizing Late: Oct 10, 10:00 PM – Oct 11, 12:00 AM")).toBeInTheDocument();
        expect(onEventUpdate).not.toHaveBeenCalled();
        await user.keyboard("{ArrowRight}");
        expect(screen.getByText("Resizing Late: Oct 10, 10:00 PM – Oct 11, 12:00 AM")).toBeInTheDocument();
        expect(onEventUpdate).not.toHaveBeenCalled();
        await user.keyboard("{Enter}");

        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        expect(onEventUpdate.mock.calls[0][0].end).toEqual(new Date(2026, 9, 11, 0));
        expect(onEventUpdate.mock.calls[0][0].start).toBe(late.start);
        expect(onEventUpdate.mock.calls[0][0].metadata).toBe(late.metadata);
    });
    it("month keyboard resize changes the inclusive all-day end date", async () => {
        const user = userEvent.setup();
        const onEventUpdate = vi.fn();
        const allDay = {
            ...event,
            allDay: true,
            end: new Date(2026, 9, 7, 23, 59, 59, 999),
            start: new Date(2026, 9, 6),
            title: "All-day meeting",
        };
        render(
            <EventCalendar
                events={[allDay]}
                now={date}
                initialDate={date}
                initialView="month"
                onEventUpdate={onEventUpdate}
            />,
        );

        screen.getByRole("button", {name: "Adjust end of All-day meeting"}).focus();
        await user.keyboard("{ArrowRight}{Enter}");

        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        expect(onEventUpdate.mock.calls[0][0].end).toEqual(new Date(2026, 9, 8, 23, 59, 59, 999));
    });
    it("month keyboard resize advances one local date and preserves the fixed endpoint clock", async () => {
        const user = userEvent.setup();
        const onEventUpdate = vi.fn();
        render(
            <EventCalendar
                events={[event]}
                now={date}
                initialDate={date}
                initialView="month"
                onEventUpdate={onEventUpdate}
            />,
        );

        screen.getByRole("button", {name: "Adjust end of Meeting"}).focus();
        await user.keyboard("{ArrowRight}");
        expect(screen.getByText("Resizing Meeting: Oct 4, 9:00 AM – Oct 5, 10:37 AM")).toBeInTheDocument();
        expect(onEventUpdate).not.toHaveBeenCalled();
        await user.keyboard("{Enter}");

        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        expect(onEventUpdate.mock.calls[0][0].start).toBe(event.start);
        expect(onEventUpdate.mock.calls[0][0].end).toEqual(new Date(2026, 9, 5, 10, 37));
        expect(onEventUpdate.mock.calls[0][0].metadata).toBe(event.metadata);
    });
});
