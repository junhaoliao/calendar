import {useState} from "react";

import {startOfDay} from "date-fns";
import {Trash2Icon} from "lucide-react";
import {useCalendarTranslation} from "../../i18n/translations";

import {Alert, AlertDescription} from "../ui/alert";
import {Button} from "../ui/button";
import {Checkbox} from "../ui/checkbox";
import {Field, FieldGroup, FieldLabel, FieldLegend, FieldSet} from "../ui/field";
import {Input} from "../ui/input";
import {RadioGroup, RadioGroupItem} from "../ui/radio-group";
import {Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle} from "../ui/sheet";
import {Textarea} from "../ui/textarea";
import {EVENT_COLORS} from "../../core/dates";
import {DateField, TimeField} from "./editor-fields";
import type {CalendarEvent, EventDraft, EventColor, NewCalendarEvent} from "./types";
import {useEventDraft} from "./use-event-draft";

interface EventEditorProps {
    draft: EventDraft;
    onClose: () => void;
    onCreate: (event: NewCalendarEvent) => void;
    onUpdate: (event: CalendarEvent) => void;
    onDelete: (id: string) => void;
}

/**
 * Owns an isolated draft for one opening of the editor; consumer data stays controlled.
 */
const EventEditor = ({draft, onClose, onCreate, onUpdate, onDelete}: EventEditorProps) => {
    const {tCalendar} = useCalendarTranslation();
    const colorLabels = {
        sky: tCalendar(($) => $.colors.sky),
        amber: tCalendar(($) => $.colors.amber),
        violet: tCalendar(($) => $.colors.violet),
        rose: tCalendar(($) => $.colors.rose),
        emerald: tCalendar(($) => $.colors.emerald),
        orange: tCalendar(($) => $.colors.orange),
    };
    const [isOpen, setIsOpen] = useState(true);
    const {
        prefix,
        title,
        setTitle,
        description,
        setDescription,
        location,
        setLocation,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        startMinute,
        setStartMinute,
        endMinute,
        setEndMinute,
        allDay,
        setAllDay,
        color,
        setColor,
        error,
        setError,
        save,
    } = useEventDraft(
        draft.event,
        (saved) => {
            if (draft.mode === "edit") {
                // Edit mode starts from a CalendarEvent, so the saved value retains its id.
                onUpdate(saved as CalendarEvent);
            } else {
                onCreate(saved);
            }
            setIsOpen(false);
        },
        draft.mode,
    );

    return (
        <Sheet
            open={isOpen}
            onOpenChange={setIsOpen}
            onOpenChangeComplete={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <SheetContent className="w-full gap-0 max-sm:w-[92%] sm:max-w-md" showCloseButton={false} side="right">
                <SheetHeader className="shrink-0 border-b">
                    <SheetTitle>
                        {draft.mode === "edit"
                            ? tCalendar(($) => $.editor.title.edit)
                            : tCalendar(($) => $.editor.title.create)}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        {draft.mode === "edit"
                            ? tCalendar(($) => $.editor.description.edit)
                            : tCalendar(($) => $.editor.description.create)}
                    </SheetDescription>
                </SheetHeader>
                <form
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save();
                    }}
                >
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        {error && (
                            <Alert className="mb-4" variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor={`${prefix}-title`}>
                                    {tCalendar(($) => $.editor.fields.title)}
                                </FieldLabel>
                                <Input
                                    id={`${prefix}-title`}
                                    value={title}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                    }}
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor={`${prefix}-description`}>
                                    {tCalendar(($) => $.editor.fields.description)}
                                </FieldLabel>
                                <Textarea
                                    id={`${prefix}-description`}
                                    rows={3}
                                    value={description}
                                    onChange={(e) => {
                                        setDescription(e.target.value);
                                    }}
                                />
                            </Field>
                            <FieldGroup className="flex-row">
                                <DateField
                                    date={startDate}
                                    id={`${prefix}-start-date`}
                                    label={tCalendar(($) => $.editor.fields.startDate)}
                                    onChange={(value) => {
                                        setStartDate(value);
                                        if (startOfDay(endDate) < value) {
                                            setEndDate(value);
                                        }
                                        setError("");
                                    }}
                                />
                                {!allDay && (
                                    <TimeField
                                        id={`${prefix}-start-time`}
                                        label={tCalendar(($) => $.editor.fields.startTime)}
                                        minute={startMinute}
                                        onChange={setStartMinute}
                                    />
                                )}
                            </FieldGroup>
                            <FieldGroup className="flex-row">
                                <DateField
                                    date={endDate}
                                    id={`${prefix}-end-date`}
                                    label={tCalendar(($) => $.editor.fields.endDate)}
                                    minimum={startDate}
                                    onChange={(value) => {
                                        setEndDate(value);
                                        setError("");
                                    }}
                                />
                                {!allDay && (
                                    <TimeField
                                        id={`${prefix}-end-time`}
                                        isInvalid={Boolean(error)}
                                        label={tCalendar(($) => $.editor.fields.endTime)}
                                        minute={endMinute}
                                        onChange={setEndMinute}
                                    />
                                )}
                            </FieldGroup>
                            <Field className="gap-2" orientation="horizontal">
                                <Checkbox checked={allDay} id={`${prefix}-all-day`} onCheckedChange={setAllDay} />
                                <FieldLabel htmlFor={`${prefix}-all-day`}>
                                    {tCalendar(($) => $.editor.fields.allDay)}
                                </FieldLabel>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor={`${prefix}-location`}>
                                    {tCalendar(($) => $.editor.fields.location)}
                                </FieldLabel>
                                <Input
                                    id={`${prefix}-location`}
                                    value={location}
                                    onChange={(e) => {
                                        setLocation(e.target.value);
                                    }}
                                />
                            </Field>
                            <FieldSet>
                                <FieldLegend variant="label">{tCalendar(($) => $.editor.fields.color)}</FieldLegend>
                                <RadioGroup
                                    aria-label={tCalendar(($) => $.editor.fields.color)}
                                    className="flex gap-1.5"
                                    value={color}
                                    onValueChange={(value) => {
                                        setColor(value as EventColor);
                                    }}
                                >
                                    {EVENT_COLORS.map((value) => (
                                        <RadioGroupItem
                                            aria-label={colorLabels[value]}
                                            className="calendar-color size-6"
                                            data-color={value}
                                            key={value}
                                            value={value}
                                        />
                                    ))}
                                </RadioGroup>
                            </FieldSet>
                        </FieldGroup>
                    </div>
                    <SheetFooter className="shrink-0 flex-row border-t">
                        {draft.mode === "edit" && (
                            <Button
                                aria-label={tCalendar(($) => $.editor.actions.delete)}
                                size="icon"
                                type="button"
                                variant="destructive"
                                onClick={() => {
                                    onDelete(draft.event.id);
                                    setIsOpen(false);
                                }}
                            >
                                <Trash2Icon />
                            </Button>
                        )}
                        <div className="flex flex-1 justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsOpen(false);
                                }}
                            >
                                {tCalendar(($) => $.editor.actions.cancel)}
                            </Button>
                            <Button type="submit">{tCalendar(($) => $.editor.actions.save)}</Button>
                        </div>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
};

export {EventEditor};
