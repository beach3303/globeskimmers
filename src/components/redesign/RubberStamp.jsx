// RubberStamp: the stamp action, identical in every world (the bible's shared finder frame,
// part 5; principle 7; Palettes.dc.html L388-396). A cream button with a 1.5px dashed
// stamp-red ring inset 3px like a stamp's perforation, a lucide Stamp and a 15/700
// stamp-red label (5.15:1 on cream). It is never a solid fill, so a card keeps exactly one
// solid button: its Directions.
//
//   <RubberStamp state onClick disabled placeName className style>{label}</RubberStamp>
//   state 'idle' (default)  The drawn state: full width, min-height 48, radius 14, cream,
//                           the ring (radius 11), Stamp 18 and the label: children, or
//                           STAMP_LABEL.here ('I was here, get the stamp') without them.
//   state 'busy'            Plan-authored (no artboard): the ring at 70% and 'Checking you
//                           are here…'. aria-busy.
//   state 'stamped'         Plan-authored: cream with a 1px cream-rule edge, Check and 'In
//                           your Virtual Passport' in the open green (5.86:1). A GPS grant.
//   state 'reported'        Plan-authored: the same edge with the Stamp and the words in ink,
//                           and no Check. A stamp granted on a report never claims a GPS
//                           proof (the worker answers with the stamp's strongest proof ever).
//   onClick                 Called only in the idle state and only when not disabled.
//   disabled                Idle but not tappable right now (a report is being sent): 50%.
//   placeName               Read after the idle label by screen readers only ('I was here,
//                           get the stamp, Getty Center'), so two stamps on one list differ.
// Every state is the same <button>: it keeps keyboard focus from tap to result, and is
// aria-disabled (not `disabled`) whenever a tap would do nothing. The ref and other props go
// on the button. The words change with the state; the toast that follows a grant is what
// screen readers hear (Toast's live region).
import React from 'react';
import { Check, Stamp } from 'lucide-react';
import { NEUTRAL, fs } from './constants';

/** @typedef {import('react').CSSProperties} CSS */

// The labels by stamp kind (plan F6 detail 2). official: an iconic place's official stamp
// and a Local favorite (today's meaning, 'Stamp it, I'm here'); here: the typographic
// I-was-here stamp of every other place (the board's label).
export const STAMP_LABEL = Object.freeze({
  official: 'Stamp it, I’m here',
  here: 'I was here, get the stamp',
  busy: 'Checking you are here…',
  done: 'In your Virtual Passport',
});

const STATES = ['idle', 'busy', 'stamped', 'reported'];

/**
 * @param {{
 *   state?: 'idle'|'busy'|'stamped'|'reported', onClick?: (e: any) => void, disabled?: boolean,
 *   placeName?: string, children?: import('react').ReactNode, className?: string, style?: CSS,
 *   [key: string]: any,
 * }} props
 * @param {any} ref
 */
function RubberStampWithRef(
  {
    state = 'idle',
    onClick = undefined,
    disabled = false,
    placeName = undefined,
    children = undefined,
    className = undefined,
    style = undefined,
    ...rest
  },
  ref,
) {
  const s = STATES.includes(state) ? state : 'idle';
  const idle = s === 'idle';
  const busy = s === 'busy';
  const done = s === 'stamped' || s === 'reported';
  const live = idle && !disabled;
  const ink = s === 'stamped' ? NEUTRAL.open : s === 'reported' ? NEUTRAL.ink : NEUTRAL.stamp;
  const Icon = s === 'stamped' ? Check : Stamp;
  const label = busy ? STAMP_LABEL.busy : done ? STAMP_LABEL.done : (children ?? STAMP_LABEL.here);
  const named = idle && typeof placeName === 'string' && placeName.trim() !== '';
  return (
    <button
      ref={ref}
      type="button"
      aria-disabled={live ? undefined : 'true'}
      aria-busy={busy ? 'true' : undefined}
      {...rest}
      onClick={live ? onClick : undefined}
      className={`${live ? 'transition-transform active:scale-[0.99] ' : ''}${className || ''}`.trim() || undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        minHeight: 48,
        boxSizing: 'border-box',
        margin: 0,
        padding: '8px 18px',
        borderRadius: 14,
        background: NEUTRAL.cream,
        border: done ? `1px solid ${NEUTRAL.creamRule}` : 0,
        color: ink,
        fontFamily: 'inherit',
        fontSize: fs(15),
        lineHeight: 1.2,
        fontWeight: 700,
        textAlign: 'center',
        cursor: live ? 'pointer' : 'default',
        opacity: idle && disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {done ? null : (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 3,
            border: `1.5px dashed ${NEUTRAL.stamp}`,
            borderRadius: 11,
            opacity: busy ? 0.7 : 1,
            pointerEvents: 'none',
          }}
        />
      )}
      <Icon
        size={18}
        color={ink}
        strokeWidth={2}
        aria-hidden="true"
        focusable="false"
        style={{ flexShrink: 0, opacity: busy ? 0.7 : 1 }}
      />
      <span style={{ minWidth: 0 }}>
        {label}
        {named ? <span className="sr-only">, {placeName}</span> : null}
      </span>
    </button>
  );
}

const RubberStamp = React.forwardRef(RubberStampWithRef);
RubberStamp.displayName = 'RubberStamp';
export default RubberStamp;
