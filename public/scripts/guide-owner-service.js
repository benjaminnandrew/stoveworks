/*
 * Puts the owner's yearly-care card first, highlighted, with a way to book it
 * (Ben, 22 Oct 2026, on the Morsø 6143's "Annual check & summer care": "that's
 * something they can call Stoveworks for").
 *
 * The guides are built in the brain and served as they are; the site adds this
 * on the way out (src/lib/guide-theme.ts), which also supplies the wording in
 * <template id="sw-service-cta">. The card is the guide's own answer, found by
 * its title ("Annual service", "Yearly service", "Upkeep checklist",
 * "Combustor & chimney care"…); it moves to the front of "Start here", and its
 * detail ends with the same offer. A guide with no such card is left as it is.
 *
 * Uses the guide template's (v3) HOME_PRIMARY, HOME_SECONDARY and openDrawer;
 * without them it does nothing.
 */
(function () {
  "use strict";

  var cta = document.getElementById("sw-service-cta");
  if (!cta || typeof HOME_PRIMARY === "undefined" || typeof openDrawer !== "function") return;

  var topics = HOME_PRIMARY.concat(typeof HOME_SECONDARY !== "undefined" ? HOME_SECONDARY : []);
  // The yearly check by name first, then general upkeep, then care of the parts a service visit
  // covers. Not glass or cooktop care, which owners do themselves.
  var RULES = [
    /annual|yearly|\byear\b|pre-season|service|inspection|check-up/i,
    /upkeep|routine|maintenance|checklist/i,
    /(chimney|combustor|catalyst|seasonal).*\bcare\b|\bcare\b.*(chimney|combustor|catalyst)/i,
  ];
  var care = null;
  RULES.some(function (rx) {
    care =
      topics.find(function (t) {
        return rx.test(t.title) && !/warranty/i.test(t.title);
      }) || null;
    return Boolean(care);
  });
  if (!care) return;

  var start = document.getElementById("homeTiles");
  var tile = Array.prototype.slice
    .call(document.querySelectorAll("#homeTiles .tile, #homeTiles2 .tile"))
    .find(function (b) {
      var h = b.querySelector("h3");
      return h && h.textContent.trim() === String(care.title).trim();
    });
  if (!start || !tile) return;

  var box = document.createElement("div");
  box.className = "sw-service";
  start.insertBefore(box, start.firstChild);
  tile.classList.add("sw-service-tile");
  box.appendChild(tile);
  box.appendChild(cta.content.cloneNode(true));

  // "Good to know" may now be empty.
  var rest = document.getElementById("homeTiles2");
  var restSec = document.getElementById("homeSec2");
  if (rest && restSec && !rest.children.length) restSec.style.display = "none";

  // The card's detail ends with the same offer.
  var original = openDrawer;
  openDrawer = function (id) {
    original(id);
    if (id !== care.id) return;
    var body = document.getElementById("dBody");
    if (body && !body.querySelector(".sw-service-cta")) body.appendChild(cta.content.cloneNode(true));
  };
})();
