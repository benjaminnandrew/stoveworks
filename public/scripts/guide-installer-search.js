/*
 * The installer's search box at the top of every owner & installer guide
 * (Ben, 22 Oct 2026: "a really obvious and easy to type and talk search box for
 * the installers side of things").
 *
 * The guides are built in the brain and served as they are; the site adds this
 * box on the way out (src/lib/guide-theme.ts). It searches what the guide
 * already holds, the hand-written answers (INDEX) and the full text of every
 * manual page (PAGES), and uses the guide's own openDrawer and openPDF, so a
 * result opens the guide's answer or the PDF at that page. Those names come
 * from the guide template (v3); if a rebuilt template drops them, the box
 * removes itself and the guide's own searches carry on.
 *
 * Unlike the guide's own searches, which want the exact phrase, this takes
 * words in any order, so a spoken question finds its answer: "what's the
 * clearance to the side wall" looks for clearance, side and wall.
 */
(function () {
  "use strict";

  var panel = document.querySelector(".sw-isearch");
  if (!panel) return;
  var box = document.getElementById("sw-iq");
  var out = document.getElementById("sw-iresults");
  var tryLine = document.getElementById("sw-itry");
  var talkBtn = document.getElementById("sw-italk");

  var ready =
    typeof PAGES !== "undefined" &&
    typeof INDEX !== "undefined" &&
    typeof normQ === "function" &&
    typeof openPDF === "function" &&
    typeof openDrawer === "function";
  if (!ready) {
    panel.remove();
    return;
  }

  // Words people say around the thing they want.
  var STOP = new Set(
    (
      "a an and any are as at be by can could do does for from get give go got have how i i'm im in into is it it's its " +
      "let me my need of ok okay on or our please should show so tell that the there this to up us want was we what what's whats " +
      "when where which who why will with would you your about much many find look looking"
    ).split(" "),
  );

  /* What installers say, and what manuals print: either finds the other. */
  var ALSO = {
    tall: ["height", "high"],
    taller: ["height", "high"],
    high: ["height"],
    higher: ["height"],
    height: ["high", "tall"],
    far: ["clearance", "distance"],
    distance: ["clearance"],
    clearance: ["distance"],
    pipe: ["connector"],
    stovepipe: ["connector", "pipe"],
    connector: ["pipe"],
    fan: ["blower"],
    blower: ["fan"],
    error: ["fault", "code"],
    fault: ["error"],
    code: ["error", "fault"],
    pad: ["protect"],
    cat: ["catalytic", "combustor"],
    catalyst: ["catalytic", "combustor"],
    propane: ["lp"],
    lp: ["propane"],
    ng: ["natural"],
    natural: ["ng"],
    igniter: ["ignitor"],
    ignitor: ["igniter"],
    mobile: ["manufactured"],
    manufactured: ["mobile"],
    fresh: ["outside", "outdoor"],
    outside: ["outdoor", "fresh"],
    outdoor: ["outside"],
    remote: ["handset", "transmitter"],
  };
  var forms = function (t) {
    return [t].concat(ALSO[t] || []);
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* "clearances" → "clearance", "venting" → "vent"; numbers and short words as typed. */
  function stem(w) {
    if (/\d/.test(w) || w.length < 5) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + "y";
    if (/(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
    if (/ing$/.test(w) && w.length > 6) return w.slice(0, -3);
    if (/ed$/.test(w) && w.length > 5) return w.slice(0, -2);
    if (/s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function termsOf(raw) {
    var seen = {};
    return normQ(raw)
      .split(/[^a-z0-9./'"-]+/)
      .map(function (w) {
        return w.replace(/^[.'"-]+|[.'"-]+$/g, "");
      })
      .filter(function (w) {
        return w && !STOP.has(w) && (w.length > 1 || /\d/.test(w));
      })
      .map(stem)
      .filter(function (w) {
        return seen[w] ? false : (seen[w] = true);
      });
  }

  /* Most of the words, all of them when there are only one or two; the whole phrase counts extra. */
  function rank(items, textOf, terms, phrase) {
    var need = terms.length <= 2 ? terms.length : Math.ceil(terms.length * 0.66);
    var ranked = [];
    items.forEach(function (item, i) {
      var text = textOf(item);
      var hits = 0;
      terms.forEach(function (t) {
        if (forms(t).some(function (f) { return text.indexOf(f) >= 0; })) hits++;
      });
      if (hits < need) return;
      var score = hits * 10 + (phrase && text.indexOf(phrase) >= 0 ? 25 : 0);
      // A contents page lists every topic, so it matches nearly anything: put it after the real pages.
      if (/(\.{6,}|_{6,})[^]*(\.{6,}|_{6,})[^]*(\.{6,}|_{6,})/.test(text)) score -= 30;
      ranked.push({ item: item, score: score, i: i });
    });
    return ranked.sort(function (a, b) {
      return b.score - a.score || a.i - b.i;
    });
  }

  /* A stretch of the page around the first word found, every searched word marked. */
  function snippet(pg, terms) {
    var words = [].concat.apply([], terms.map(forms));
    var at = -1;
    words.forEach(function (t) {
      var i = pg.f.indexOf(t);
      if (i >= 0 && (at < 0 || i < at)) at = i;
    });
    var a = Math.max(0, at - 60);
    var b = Math.min(pg.s.length, Math.max(at, 0) + 150);
    var frag = pg.s.slice(a, b);
    var low = pg.f.slice(a, b);
    var marks = [];
    words.forEach(function (t) {
      for (var j = low.indexOf(t); j >= 0; j = low.indexOf(t, j + t.length)) marks.push([j, j + t.length]);
    });
    marks.sort(function (x, y) {
      return x[0] - y[0];
    });
    var html = "";
    var pos = 0;
    marks.forEach(function (m) {
      if (m[0] < pos) return;
      html += esc(frag.slice(pos, m[0])) + "<mark>" + esc(frag.slice(m[0], m[1])) + "</mark>";
      pos = m[1];
    });
    html += esc(frag.slice(pos));
    return (a > 0 ? "… " : "") + html + (b < pg.s.length ? " …" : "");
  }

  var pageLabel = function (pg) {
    return typeof pgLabel === "function" ? pgLabel(pg) : "p." + pg.p;
  };
  var MANUAL = typeof MULTI !== "undefined" && MULTI ? "manuals" : "manual";

  function render() {
    var raw = box.value.trim();
    var terms = termsOf(raw);
    if (!terms.length) {
      out.innerHTML = "";
      panel.classList.remove("has-results");
      return;
    }
    var phrase = normQ(raw).replace(/\s+/g, " ").trim();
    var topics = rank(INDEX, function (x) { return x.f; }, terms, phrase)
      // On the installer side, the installer's answers first.
      .sort(function (a, b) {
        return b.score - a.score || (a.item.k === "i" ? 0 : 1) - (b.item.k === "i" ? 0 : 1);
      })
      // The same answer can be indexed twice (a spec card and its detail): show it once.
      .filter(function (r, i, all) {
        return all.findIndex(function (o) { return o.item.t === r.item.t; }) === i;
      })
      .slice(0, 6);
    var pages = rank(PAGES, function (pg) { return pg.f; }, terms, phrase);

    var html =
      '<p class="sw-ir-looking">Looking for <strong>' +
      terms
        .map(function (t) {
          return esc(t) + (ALSO[t] ? " (or " + esc(ALSO[t][0]) + ")" : "");
        })
        .join(" · ") +
      "</strong></p>";
    if (topics.length) {
      html += '<p class="sw-ir-group">In this guide</p>';
      html += topics
        .map(function (r) {
          var x = r.item;
          return (
            '<button type="button" class="sw-ri" data-topic="' + esc(x.id) + '">' +
            '<span class="sw-ri-kind">' + (x.k === "i" ? "Installer" : "Owner") + "</span>" +
            "<strong>" + esc(x.t) + "</strong>" +
            "<span>" + esc(String(x.p).replace(/<[^>]+>/g, "")) + "</span></button>"
          );
        })
        .join("");
    }
    if (pages.length) {
      html +=
        '<p class="sw-ir-group">In the ' + MANUAL + " <span>" + pages.length + " page" + (pages.length > 1 ? "s" : "") +
        " · each opens the PDF at that page</span></p>";
      html += pages
        .slice(0, 20)
        .map(function (r) {
          var pg = r.item;
          return (
            '<button type="button" class="sw-ri is-page" data-doc="' + pg.d + '" data-page="' + pg.p + '">' +
            '<span class="sw-ri-kind">' + pageLabel(pg) + "</span>" +
            "<span>" + snippet(pg, terms) + "</span></button>"
          );
        })
        .join("");
    }
    if (!topics.length && !pages.length) {
      html +=
        '<p class="sw-ir-none">Nothing in this guide or its ' + MANUAL + " matched. Try fewer words, or a part name.</p>";
    }
    out.innerHTML = html;
    panel.classList.add("has-results");
  }

  out.addEventListener("click", function (e) {
    var hit = e.target.closest(".sw-ri");
    if (!hit) return;
    if (hit.dataset.topic) openDrawer(hit.dataset.topic);
    else openPDF(hit.dataset.page, Number(hit.dataset.doc));
  });

  var timer = 0;
  box.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  });
  box.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      render();
      box.blur(); // puts the phone keyboard away so the results show
    }
  });

  // This guide's own hints ("clearance, floor shield, chimney height…") as things to try.
  var mq = document.getElementById("mq");
  var hint = mq && (mq.getAttribute("placeholder") || "").split("—")[1];
  var tries = hint
    ? hint
        .replace(/…|\.\.\./g, "")
        .split(",")
        .map(function (s) { return s.trim(); })
        .filter(Boolean)
        .slice(0, 4)
    : [];
  if (tries.length) {
    tryLine.innerHTML =
      "Try " +
      tries
        .map(function (t) {
          return '<button type="button" class="sw-itry" data-q="' + esc(t) + '">' + esc(t) + "</button>";
        })
        .join(" ");
    tryLine.addEventListener("click", function (e) {
      var b = e.target.closest(".sw-itry");
      if (!b) return;
      box.value = b.dataset.q;
      render();
    });
  }

  // Talk: the browser's own speech recognition (Chrome, Edge, Safari); hidden where there is none.
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec || !talkBtn) {
    if (talkBtn) talkBtn.hidden = true;
    return;
  }
  var rec = null;
  var label = talkBtn.querySelector("span");
  function stop() {
    talkBtn.classList.remove("is-listening");
    talkBtn.setAttribute("aria-pressed", "false");
    label.textContent = "Talk";
    rec = null;
  }
  talkBtn.addEventListener("click", function () {
    if (rec) {
      rec.stop();
      return;
    }
    rec = new Rec();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = function (e) {
      var text = "";
      for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      box.value = text.trim();
      render();
    };
    rec.onerror = function (e) {
      out.innerHTML =
        '<p class="sw-ir-none">' +
        (e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "The microphone is blocked. Allow it for this site, or type instead."
          : e.error === "no-speech"
            ? "I didn't hear anything. Tap Talk and try again."
            : "Talk didn't work just now. Type instead.") +
        "</p>";
    };
    rec.onend = stop;
    talkBtn.classList.add("is-listening");
    talkBtn.setAttribute("aria-pressed", "true");
    label.textContent = "Listening… tap to stop";
    box.value = "";
    rec.start();
  });
})();
