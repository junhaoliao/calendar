import {type Draggable, type KeyboardSensorOptions, type Sensors, PointerActivationConstraints} from "@dnd-kit/dom";
import {KeyboardSensor, PointerSensor} from "@dnd-kit/react";

const DRAG_DISTANCE = 5;
const TOUCH_DELAY = 250;

/** Ensures resizing ends a keyboard session with cancellation and sensor cleanup. */
class CalendarKeyboardSensor extends KeyboardSensor {
    /**
     * Installs cancellation ahead of Feedback's resize listener.
     *
     * @param event Pickup key.
     * @param source Original draggable.
     * @param options Keyboard configuration.
     */
    protected override handleStart(
        event: KeyboardEvent,
        source: Draggable,
        options: KeyboardSensorOptions | undefined,
    ) {
        window.addEventListener("resize", this.cancelOnResize, true);
        super.handleStart(event, source, options);
    }

    /** Releases both resize and keyboard session listeners. */
    protected override cleanup() {
        window.removeEventListener("resize", this.cancelOnResize, true);
        super.cleanup();
    }

    private cancelOnResize = (event: Event) => {
        this.handleEnd(event, true);
    };
}

const CALENDAR_SENSORS: Sensors = [
    PointerSensor.configure({
        activationConstraints: (event) =>
            event.pointerType === "touch"
                ? [
                      new PointerActivationConstraints.Delay({
                          tolerance: DRAG_DISTANCE,
                          value: TOUCH_DELAY,
                      }),
                  ]
                : [
                      new PointerActivationConstraints.Distance({
                          value: DRAG_DISTANCE,
                      }),
                  ],
    }),
    CalendarKeyboardSensor,
];

export {CALENDAR_SENSORS, DRAG_DISTANCE, TOUCH_DELAY};
