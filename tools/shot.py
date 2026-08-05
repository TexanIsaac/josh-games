"""Take pictures of the running game, headless, so you can actually look at it.

    py -3.12 tools/shot.py                 # closeup, the one to use by default
    py -3.12 tools/shot.py closeup trench  # several at once
    py -3.12 tools/shot.py --keep closeup  # leave _shot.html behind to poke at

Writes shots/<mode>.png. Nothing it produces is committed; shots/ and _shot.html
are both in .gitignore.

Why this exists: the test suite cannot see. It counts canvas operations and
asserts on numbers, and twice a bug has been invisible to all 700 of those checks
and instantly obvious in a picture:

  July      the blocky rig was built but drawGuy still called the old rounded
            painter, so none of it ever reached the screen
  2 August  shade() could not read its own output, so every character in the game
            had a black arm and a black leg

Neither was findable by reading the code with a theory in hand. Both took ten
seconds to see. **If someone says it looks wrong, take a picture first.**

The one real trap: the map is generated fresh on every reset, so trench and
faces modes sometimes frame a wall or put the camera inside geometry. Just run
it again. closeup does not depend on the map and always frames cleanly, which is
why it is the default.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, "index.html")
HARNESS = os.path.join(ROOT, "tools", "shot_harness.js")
PAGE = os.path.join(ROOT, "_shot.html")
OUTDIR = os.path.join(ROOT, "shots")

CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

MODES = ("closeup", "faces", "trench", "inside")


def find_browser():
    for path in CHROMES:
        if os.path.exists(path):
            return path
    sys.exit("No Chrome or Edge found. Add the path to CHROMES in tools/shot.py.")


def build_page():
    """Inject the harness INSIDE the game's own <script>, so it shares that scope.

    A separate <script> tag would not be able to see player, grid, cam or any of
    the rest of it. This is the same trick tests/run.js uses to build its G.
    """
    with open(GAME, "r", encoding="utf-8", newline="") as fh:
        game = fh.read()
    with open(HARNESS, "r", encoding="utf-8", newline="") as fh:
        harness = fh.read()
    cut = game.rindex("</script>")
    with open(PAGE, "w", encoding="utf-8", newline="") as fh:
        fh.write(game[:cut] + harness + game[cut:])


def shoot(browser, mode):
    out = os.path.join(OUTDIR, mode + ".png")
    if os.path.exists(out):
        os.remove(out)
    subprocess.run([
        browser,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-sandbox",
        # The game runs on requestAnimationFrame, so it needs virtual time to advance
        # or the shot lands on frame one, before anything is posed.
        "--virtual-time-budget=5200",
        "--window-size=1280,800",
        "--screenshot=" + out,
        "file:///" + PAGE.replace("\\", "/") + "?mode=" + mode,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    if os.path.exists(out):
        print("  %-8s -> %s  (%d KB)" % (mode, out, os.path.getsize(out) // 1024))
        return True
    print("  %-8s FAILED, nothing written" % mode)
    return False


def main():
    args = [a for a in sys.argv[1:] if a != "--keep"]
    keep = "--keep" in sys.argv[1:]
    modes = args or ["closeup"]
    bad = [m for m in modes if m not in MODES]
    if bad:
        sys.exit("Unknown mode(s): %s. Pick from: %s" % (", ".join(bad), ", ".join(MODES)))

    os.makedirs(OUTDIR, exist_ok=True)
    browser = find_browser()
    build_page()
    ok = True
    for mode in modes:
        ok = shoot(browser, mode) and ok
    if not keep and os.path.exists(PAGE):
        os.remove(PAGE)
    if not ok:
        sys.exit(1)
    print("Look at them. Do not just run the tests and assume.")


if __name__ == "__main__":
    main()
