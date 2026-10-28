"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

/**
 * The site search box: type, or tap Talk and say it.
 *
 * It's a plain GET form to /search/, so it works before (and without)
 * JavaScript. With JavaScript it adds name suggestions as you type and voice
 * input. Voice uses the browser's own speech recognition (Chrome, Edge and
 * Safari have it; Firefox doesn't), so the Talk button only appears where it
 * will work. Every box lands on the same search (docs/smart-search-plan.md).
 */

type Suggestion = { label: string; message: string; url: string };

/* The Web Speech API isn't in TypeScript's DOM types everywhere. */
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function speechCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const VOICE_ERRORS: Record<string, string> = {
  "not-allowed": "The microphone is blocked. Allow it for this site in your browser, or type instead.",
  "service-not-allowed": "Voice search isn't allowed in this browser. Type instead.",
  "no-speech": "I didn't hear anything. Tap Talk and try again.",
  "audio-capture": "No microphone was found. Type instead.",
  network: "Voice search needs an internet connection. Type instead.",
};

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function SearchBox({
  variant = "bar",
  surface = "page",
  defaultValue = "",
  autoFocus = false,
  placeholder = "Search stoves, brands, or ask a question",
}: {
  variant?: "hero" | "bar" | "drawer";
  surface?: "home" | "header" | "page" | "drawer";
  defaultValue?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [canTalk, setCanTalk] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Only after mount: the server can't know whether this browser does speech.
  useEffect(() => setCanTalk(Boolean(speechCtor())), []);
  useEffect(() => setValue(defaultValue), [defaultValue]);
  useEffect(() => () => recRef.current?.abort(), []);

  // Suggestions as you type, a moment after the last keystroke.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || listening) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((j: { suggestions?: Suggestion[] }) => {
          setItems(Array.isArray(j.suggestions) ? j.suggestions.slice(0, 6) : []);
          setActive(-1);
        })
        .catch(() => {});
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, listening]);

  // Close the list on a click elsewhere.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const go = (q: string, voice = false) => {
    const text = q.trim();
    if (!text) return;
    setOpen(false);
    router.push(`/search/?q=${encodeURIComponent(text)}&from=${surface}${voice ? "&voice=1" : ""}`);
  };

  const talk = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setValue((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") setStatus(VOICE_ERRORS[e.error] ?? "Voice search stopped. Try again, or type instead.");
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (finalText.trim()) {
        setStatus(`Searching for “${finalText.trim()}”`);
        go(finalText, true);
      }
    };
    recRef.current = rec;
    setStatus("Listening… say a brand, a model, or your question.");
    setOpen(false);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setStatus("Voice search couldn't start. Type instead.");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      setOpen(false);
      router.push(items[active].url);
    }
  };

  const showList = open && items.length > 0 && !listening;

  return (
    <div ref={wrapRef} className={`searchbox searchbox-${variant}${listening ? " is-listening" : ""}`}>
      <form
        role="search"
        action="/search/"
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
      >
        <input type="hidden" name="from" value={surface} />
        <label htmlFor={`${id}-q`} className="visually-hidden">
          Search the site
        </label>
        <span className="searchbox-icon">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          id={`${id}-q`}
          name="q"
          type="search"
          value={value}
          placeholder={listening ? "Listening…" : placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="search"
          maxLength={300}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setStatus("");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {canTalk ? (
          <button
            type="button"
            className="searchbox-talk"
            onClick={talk}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Search by voice"}
          >
            <MicIcon />
            <span className="searchbox-talk-label">{listening ? "Stop" : "Talk"}</span>
          </button>
        ) : null}
        <button type="submit" className="searchbox-go">
          {variant === "hero" ? "Search" : <SearchIcon />}
          {variant === "hero" ? null : <span className="visually-hidden">Search</span>}
        </button>
      </form>

      {showList ? (
        <ul id={listId} role="listbox" className="searchbox-list" aria-label="Suggestions">
          {items.map((s, i) => {
            const [name, type] = s.label.split(" · ");
            return (
              <li
                key={s.url + i}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? "is-active" : undefined}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  router.push(s.url);
                }}
              >
                <strong>{name}</strong>
                {type ? <small>{type}</small> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="searchbox-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
