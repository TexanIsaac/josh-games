"""Generate the hosted version of the game from index.html.

index.html is the real file. It is a complete standalone page that runs from a
plain web server or straight off the filesystem. The hosted version needs the
same content with the page skeleton removed, because the host supplies its own
<head> and <body>.

Keeping this as a script instead of a second hand-edited copy means there is only
ever one place to change the game. Run it after editing index.html:

    py -3.12 build-artifact.py
"""

import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / 'index.html'
OUT = HERE / 'artifact-page.html'


def grab(pattern: str, text: str, what: str) -> str:
    m = re.search(pattern, text, re.S)
    if not m:
        sys.exit(f'Could not find the {what} in index.html. Did the file structure change?')
    return m.group(1)


def main() -> None:
    html = SRC.read_text(encoding='utf-8')

    style = grab(r'<style>(.*?)</style>', html, '<style> block')
    script = grab(r'<script>(.*?)</script>', html, '<script> block')
    body = grab(r'<body>(.*?)</body>', html, '<body> content')

    # Strip the style and script out of the body markup; they get re-emitted in
    # a fixed order below so the game code always runs after the markup exists.
    body = re.sub(r'<style>.*?</style>', '', body, flags=re.S)
    body = re.sub(r'<script>.*?</script>', '', body, flags=re.S)
    body = body.strip()

    # The host owns <head>, so the viewport and web-app meta tags have to be
    # inserted at runtime. Without the viewport tag the iPad lets you pinch-zoom
    # the game and double-tap-zooms mid-fight.
    shim = """
// The page skeleton is supplied by the host, so these two tags are added here
// rather than in <head>. Without them the iPad treats the game as a document:
// pinch to zoom, double-tap to zoom, and a scrolling page under your thumb.
(function () {
  var vp = document.querySelector('meta[name="viewport"]');
  if (!vp) {
    vp = document.createElement('meta');
    vp.setAttribute('name', 'viewport');
    document.head.appendChild(vp);
  }
  vp.setAttribute('content',
    'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no');

  [['apple-mobile-web-app-capable', 'yes'],
   ['apple-mobile-web-app-status-bar-style', 'black-translucent']
  ].forEach(function (pair) {
    if (document.querySelector('meta[name="' + pair[0] + '"]')) return;
    var m = document.createElement('meta');
    m.setAttribute('name', pair[0]);
    m.setAttribute('content', pair[1]);
    document.head.appendChild(m);
  });
})();
"""

    OUT.write_text(
        '<style>' + style + '</style>\n\n' + body + '\n\n<script>' + shim + script + '</script>\n',
        encoding='utf-8',
    )
    print(f'Wrote {OUT.name}  ({OUT.stat().st_size // 1024} KB)')
    print(f'  style  {len(style):>7,} chars')
    print(f'  markup {len(body):>7,} chars')
    print(f'  script {len(script):>7,} chars')


if __name__ == '__main__':
    main()
