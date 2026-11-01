"""Open built guides in headless Chromium and exercise them like a visitor would.

    python3 scripts/smoke_guide.py guides/<id>.html [...] [--shots <dir>]

Checks: no script errors; gate -> owner view -> tiles -> drawer (with its manual deep link);
owner search; header search; installer view (spec cards, steps, faults/codes sections,
full-manual search); the PDF button (menu when there are several manuals); #topic deep links.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


def smoke(page, path, shots=None):
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text else None)
    url = Path(path).resolve().as_uri()
    page.goto(url)
    page.wait_for_timeout(150)
    r = {"guide": Path(path).name}
    name = Path(path).stem
    if shots:
        page.screenshot(path=f"{shots}/{name}-1-gate.png")
    r["title"] = page.inner_text(".gate h1")
    page.click(".ignite[data-role=homeowner]")
    r["tiles"] = page.locator("#homeowner .tile").count()
    if shots:
        page.screenshot(path=f"{shots}/{name}-2-owner.png", full_page=True)
    page.locator("#homeowner .tile").first.click()
    page.wait_for_timeout(350)
    r["drawer_open"] = page.locator("#drawer.open").count() == 1
    ml = page.locator("#dBody .manlink")
    r["drawer_link"] = ml.get_attribute("href") if ml.count() else None
    if shots:
        page.screenshot(path=f"{shots}/{name}-3-drawer.png")
    page.keyboard.press("Escape")
    page.fill("#oq", "glass")
    r["owner_search_glass"] = page.locator("#oResults .ritem").count()
    page.fill("#q", "clearance")
    page.wait_for_timeout(100)
    r["header_search_clearance"] = page.locator("#rlist .ritem").count()
    badges = page.locator("#rlist .ritem .pg").all_inner_texts()[:3]
    r["page_badges"] = badges
    page.fill("#q", "")
    page.mouse.click(5, 300)
    page.click("#toggle button.inst")
    r["spec_cards"] = page.locator("#specCards .spec").count()
    r["steps"] = page.locator("#checklist .step").count()
    r["faults_shown"] = page.locator("#faultSec").is_visible()
    r["fault_panels"] = page.locator("#faults .panel").count()
    r["codes_shown"] = page.locator("#codeSec").is_visible()
    r["manual_hint"] = page.inner_text("#mResults")[:160]
    page.fill("#mq", "warning")
    r["manual_search_warning"] = page.locator("#mResults .ritem").count()
    if shots:
        page.screenshot(path=f"{shots}/{name}-4-installer.png", full_page=True)
    page.locator("#specCards .spec").first.click()
    page.wait_for_timeout(350)
    ml = page.locator("#dBody .manlink")
    r["spec_drawer_link"] = ml.get_attribute("href") if ml.count() else None
    page.keyboard.press("Escape")
    page.click("#pdfBtn")
    r["pdf_menu_items"] = page.locator("#pdfMenu.open a").count()
    page.keyboard.press("Escape")
    first_tile = page.evaluate("HOME_PRIMARY[0].id")
    page.goto("about:blank")
    page.goto(url + "#" + first_tile)
    page.wait_for_timeout(350)
    r["hash_deeplink"] = page.locator("#drawer.open").count() == 1 and page.locator("#homeowner.active").count() == 1
    page.goto("about:blank")
    page.goto(url + "#installer")
    page.wait_for_timeout(100)
    r["hash_installer"] = page.locator("#installer.active").count() == 1
    r["errors"] = errors
    return r


def main(argv):
    shots = None
    if "--shots" in argv:
        i = argv.index("--shots")
        shots = argv[i + 1]
        Path(shots).mkdir(parents=True, exist_ok=True)
        argv = argv[:i] + argv[i + 2:]
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for path in argv:
            page = b.new_page(viewport={"width": 1280, "height": 900})
            r = smoke(page, path, shots)
            problems = []
            if r["errors"]:
                problems.append("script errors")
            if not r["drawer_open"]:
                problems.append("drawer didn't open")
            if r["tiles"] < 2 or r["spec_cards"] < 3 or r["steps"] < 3:
                problems.append("missing tiles/specs/steps")
            if not r["hash_deeplink"] or not r["hash_installer"]:
                problems.append("hash deep link failed")
            r["status"] = "FAIL: " + ", ".join(problems) if problems else "ok"
            bad += bool(problems)
            print(json.dumps(r, ensure_ascii=False))
            page.close()
        if shots and argv:
            m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            m.goto(Path(argv[0]).resolve().as_uri())
            m.screenshot(path=f"{shots}/{Path(argv[0]).stem}-5-mobile.png")
            m.click(".ignite[data-role=installer]")
            m.screenshot(path=f"{shots}/{Path(argv[0]).stem}-6-mobile-installer.png")
            m.close()
        b.close()
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
