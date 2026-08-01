# Josh's games

Zombie Noobs, designed by Josh Alexander (8), built with Claude Code. Josh and his cousin
Max play it and drive what changes. This repo is the whole project.

## Scope boundary (hard rule)

Sessions in this repo touch **only** `C:\Dev\josh-games\`. Nothing else, ever.

Off limits, with no exceptions and no "just to check":

- The Obsidian vault (`...\Desktop\My Vault\`) and anything in it
- `C:\Dev\dovetail-claude\` and every other Dovetail project
- Innergy, the Dovetail Brain, Azure, Fellow, Microsoft 365, the work GitHub repos
- Any scheduled task, NSSM service, or automation on any machine

If a request would reach outside this folder, stop and say so rather than doing it. The
only remote this repo pushes to is `git@github.com:TexanIsaac/josh-games.git`.

## Working on the game

- One file, `index.html`, no build step, no dependencies. Runs from `file://` or Pages.
- Tests: `node tests/run.js`. 682 checks. Run them before every commit.
- Live at https://texanisaac.github.io/josh-games/ , auto-deploys from `main` on push.

Deploy loop: edit `index.html`, run the tests, bump `VERSION` in `index.html` **and**
`CACHE` in `sw.js`, commit, push. Miss the `CACHE` bump and the service worker keeps
serving the old game to the iPads. Pages lags 40 to 90 seconds; verify by reading
`VERSION` back off the live URL, not by trusting the push.

## Editing habits that were learned the hard way

- Patch with Python scripts using exact anchors, and assert each anchor matches exactly
  once. Sed and heredocs mangle the quoting repeatedly.
- Always extract the `<script>` and run `node --check` after editing, before testing.
- `const` declarations must come before anything that reads them.
- If a new number has to agree with an existing number, derive it from that number rather
  than guessing it a second time. Six separate bugs in the first build were this.

## Josh's design, not to be changed without him

Noob with fists, zombies bite you, enough bites and you turn, then you bite noobs. Four
ranks a side at 7 / 22 / 37 kills, mirrored. No game over, ever.

Everything else is scaffolding and can change freely.

Full build record and open questions: `HANDOFF.md`.
