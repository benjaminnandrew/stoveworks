"use client";

import { useEffect, useState } from "react";

export function ToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      className={`to-top${visible ? " is-visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Go to top"
      tabIndex={visible ? 0 : -1}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M11.7 6.3l-3-3C8.5 3.1 8.3 3 8 3s-.5.1-.7.3l-3 3c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0L7 6.4V12c0 .6.4 1 1 1s1-.4 1-1V6.4l1.3 1.3c.4.4 1 .4 1.4 0 .2-.2.3-.4.3-.7s-.1-.5-.3-.7z" />
      </svg>
    </button>
  );
}
