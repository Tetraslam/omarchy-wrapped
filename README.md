# Wrapped

Your week, wrapped: a short deck built from what's already on your machine, in dot-matrix numerals over a slow dithered shader.

- **Time**: hours at the keyboard (not AFK), by your ActivityWatch categories and day
- **Rhythm**: when you're active, your longest focus run, how often you switched apps
- **Code**: commits, lines and top repos across `~/Programming` (your git email only)
- **Agents**: OpenCode sessions, subagents and tokens by model
- **Anime**: episodes watched on Crunchyroll, with the top show's cover dithered
- **Reading**: the pages you spent the most time on
- **Card**: everything on one shareable card

Slides without data are skipped. Shaders only run on the slide on screen.

## Use

```bash
wrapped                 # this week, as an app window
wrapped --weeks-ago 1   # last week
wrapped --png card.png  # the summary card as an image
```

→ / space / click the right of the screen to advance, ← to go back, Esc to close. `#card` (or any slide id) in the URL opens on that slide.

## Install

Requires Python 3, Chromium (for the app window and PNG export) and, optionally, ActivityWatch and OpenCode.

```bash
git clone https://github.com/tetraslam/omarchy-wrapped && cd omarchy-wrapped/web
pnpm install && pnpm build
ln -s "$PWD/../bin/wrapped" ~/.local/bin/wrapped
```

Add it to the Omarchy menu in `~/.config/omarchy/extensions/omarchy-menu.jsonc`:

```jsonc
"wrapped": { "icon": "󰃭", "label": "Wrapped", "action": "wrapped" }
```

## How it works

`collect.py` gathers the week into one JSON object; `bin/wrapped` writes it beside a single-file build of `web/` and opens it. The page is React with [Paper shaders](https://shaders.paper.design) (grain gradient, dithering, image dithering) and a [Dot Matrix](https://dotmatrix.zzzzshawn.cloud) loader; the numerals are a hand-drawn 5×7 face.

```bash
python3 collect.py | jq .
python3 -m unittest discover -s tests
```

## License

MIT, except `web/src/lib/dotmatrix-*` and `web/src/components/{ui/dotm-*,dotmatrix-loader.css}`, which are from Dot Matrix under its own license (use in apps allowed, redistribution as a component library not).
