import {useMemo, useState} from "react";

import {format, startOfDay} from "date-fns";
import {CalendarIcon} from "lucide-react";
import {useCalendarTranslation} from "../../i18n/translations";

import {Button} from "../ui/button";
import {Calendar} from "../ui/calendar";
import {Field, FieldLabel} from "../ui/field";
import {Popover, PopoverContent, PopoverTrigger} from "../ui/popover";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "../ui/select";

/**
 * A shadcn date popover shared by the editor's date fields.
 */
const DateField = ({
    id,
    label,
    date,
    minimum,
    onChange,
}: {
    id: string;
    label: string;
    date: Date;
    minimum?: Date;
    onChange: (date: Date) => void;
}) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const [open, setOpen] = useState(false);
    return (
        <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    className="w-full justify-between font-normal"
                    render={<Button id={id} variant="outline" />}
                >
                    <span className="truncate">{format(date, "PPP", {locale: dateLocale})}</span>
                    <CalendarIcon className="text-muted-foreground/80" data-icon="inline-end" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                    <Calendar
                        defaultMonth={date}
                        locale={dateLocale}
                        mode="single"
                        selected={date}
                        weekStartsOn={0}
                        labels={{
                            labelNext: () => tCalendar(($) => $.datePicker.nextMonth),
                            labelPrevious: () => tCalendar(($) => $.datePicker.previousMonth),
                            labelDayButton: (day, modifiers) => {
                                const formatted = format(day, "PPPP", {locale: dateLocale});
                                if (modifiers.today && modifiers.selected) {
                                    return tCalendar(($) => $.datePicker.dayTodaySelected, {date: formatted});
                                }
                                if (modifiers.today) return tCalendar(($) => $.datePicker.dayToday, {date: formatted});
                                if (modifiers.selected)
                                    return tCalendar(($) => $.datePicker.daySelected, {date: formatted});
                                return tCalendar(($) => $.datePicker.day, {date: formatted});
                            },
                            labelGridcell: (day, modifiers) => {
                                const formatted = format(day, "PPPP", {locale: dateLocale});
                                return modifiers?.today
                                    ? tCalendar(($) => $.datePicker.dayToday, {date: formatted})
                                    : tCalendar(($) => $.datePicker.day, {date: formatted});
                            },
                        }}
                        {...(minimum
                            ? {
                                  disabled: {
                                      before: startOfDay(minimum),
                                  },
                              }
                            : {})}
                        onSelect={(selected) => {
                            if (selected) {
                                onChange(selected);
                                setOpen(false);
                            }
                        }}
                    />
                </PopoverContent>
            </Popover>
        </Field>
    );
};

/**
 * A quarter-hour shadcn select with a full accessible field label.
 */
const TimeField = ({
    id,
    label,
    minute,
    onChange,
    isInvalid,
}: {
    id: string;
    label: string;
    minute: number;
    onChange: (value: number) => void;
    isInvalid?: boolean;
}) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const timePattern = tCalendar(($) => $.formats.timeOption);
    const timeOptions = useMemo(
        () =>
            Array.from({length: 96}, (_, index) => ({
                label: format(new Date(2000, 0, 1, 0, index * 15), timePattern, {
                    locale: dateLocale,
                }),
                value: index * 15,
            })),
        [dateLocale, timePattern],
    );
    const options = timeOptions.some((option) => option.value === minute)
        ? timeOptions
        : [
              ...timeOptions,
              {
                  label: format(new Date(2000, 0, 1, 0, minute), timePattern, {
                      locale: dateLocale,
                  }),
                  value: minute,
              },
          ].sort((a, b) => a.value - b.value);

    return (
        <Field className="w-28 shrink-0" data-invalid={isInvalid || false}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Select
                items={options}
                value={minute}
                onValueChange={(value) => {
                    if (value !== null) {
                        onChange(value);
                    }
                }}
            >
                <SelectTrigger aria-invalid={isInvalid || false} className="w-full" id={id}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        </Field>
    );
};

export {DateField, TimeField};
