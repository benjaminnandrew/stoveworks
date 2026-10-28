"use client";

import { useEffect, useState } from "react";

import { business } from "@/content/site";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "17:00" → "5 PM", "09:30" → "9:30 AM". */
function clock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/** Day index and minutes past midnight in Hayward, whatever the visitor's own time zone. */
function nowInHayward() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: DAYS.indexOf(get("weekday")), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function hoursOn(day: number) {
  return business.hoursSpec.find((h) => (h.days as readonly string[]).includes(DAYS[day]));
}

function status(): { open: boolean; text: string } {
  const { day, minutes } = nowInHayward();
  const today = hoursOn(day);

  if (today && minutes >= toMinutes(today.opens) && minutes < toMinutes(today.closes)) {
    return { open: true, text: `Open now · until ${clock(today.closes)}` };
  }
  if (today && minutes < toMinutes(today.opens)) {
    return { open: false, text: `Closed · opens today at ${clock(today.opens)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const next = hoursOn((day + i) % 7);
    if (next) {
      const when = i === 1 ? "tomorrow" : DAYS[(day + i) % 7];
      return { open: false, text: `Closed · opens ${when} at ${clock(next.opens)}` };
    }
  }
  return { open: false, text: "Closed" };
}

/**
 * Open/closed from the posted hours, in Hayward time. The server can't know the
 * time a static page is viewed, so it renders the plain hours and the browser
 * swaps in the live status after load.
 */
export function OpenStatus({ fallback }: { fallback: string }) {
  const [state, setState] = useState<{ open: boolean; text: string } | null>(null);

  useEffect(() => {
    const update = () => setState(status());
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className={`open-status${state ? (state.open ? " is-open" : " is-closed") : ""}`}>
      <span className="open-dot" aria-hidden="true" />
      {state ? state.text : fallback}
    </span>
  );
}
