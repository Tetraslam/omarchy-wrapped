#!/usr/bin/env python3
"""Collect a week of your computer life into one JSON object for Wrapped.

Everything comes from what's already on this machine:
  - ActivityWatch: time by category and day, peak hours, focus streaks, apps,
    what you read, and the anime you watched (Crunchyroll window titles)
  - git: your commits across a projects directory
  - OpenCode: agent sessions and tokens by model
"""

import argparse
import collections
import configparser
import datetime as dt
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import urllib.parse
import urllib.request

HOME = Path.home()
AW = "http://127.0.0.1:5600"
UNCATEGORIZED = "#565F89"


# ------------------------------------------------------------------ helpers

def http_json(url, body=None, timeout=30, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data, {"Content-Type": "application/json", "User-Agent": "omarchy-wrapped", **(headers or {})})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def parse_time(value):
    value = value.replace("Z", "+00:00")
    head, sep, tail = value.partition(".")
    if sep:
        count = len(tail) - len(tail.lstrip("0123456789"))
        value = head + "." + tail[: min(count, 6)] + tail[count:]
    parsed = dt.datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)


def week_bounds(now, day_start_hour, weeks_ago):
    today = now.replace(hour=day_start_hour, minute=0, second=0, microsecond=0)
    if now < today:
        today -= dt.timedelta(days=1)
    end = today + dt.timedelta(days=1) - dt.timedelta(weeks=weeks_ago)
    return end - dt.timedelta(days=7), min(end, now)


# --------------------------------------------------------------- ActivityWatch

def aw_events(start, end):
    info = http_json(AW + "/api/0/info")
    buckets = http_json(AW + "/api/0/buckets/")
    host = info.get("hostname", "")

    def pick(kind):
        pool = [b for b in buckets.values() if b.get("type") == kind and b.get("hostname") == host] or \
               [b for b in buckets.values() if b.get("type") == kind]
        return max(pool, key=lambda b: b.get("last_updated") or "")["id"] if pool else None

    window, afk = pick("currentwindow"), pick("afkstatus")
    classes = http_json(AW + "/api/0/settings/classes") or []
    rules = [[c["name"], c["rule"]] for c in classes if c.get("rule", {}).get("type") not in (None, "none")]
    colors = {tuple(c["name"]): (c.get("data") or {}).get("color") for c in classes if (c.get("data") or {}).get("color")}
    query = [
        f'events = flood(query_bucket("{window}"));',
        f'not_afk = flood(query_bucket("{afk}"));',
        'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
        "events = filter_period_intersect(events, not_afk);",
        # The server's query parser keeps backslash escapes verbatim.
        "events = categorize(events, " + json.dumps(rules).replace("\\\\", "\\") + ");",
        "RETURN = events;",
    ]
    events = http_json(AW + "/api/0/query/", {"timeperiods": [f"{start.isoformat()}/{end.isoformat()}"], "query": query}, timeout=120)[0]
    return events, colors


def color_for(name, colors):
    return colors.get((name,)) or UNCATEGORIZED


def desktop_names():
    names = {}
    dirs = [os.environ.get("XDG_DATA_HOME") or str(HOME / ".local/share")] + \
        (os.environ.get("XDG_DATA_DIRS") or "/usr/local/share:/usr/share").split(":")
    for base in reversed(dirs):
        for path in Path(base, "applications").glob("*.desktop"):
            parser = configparser.ConfigParser(interpolation=None, strict=False)
            try:
                parser.read(path, encoding="utf-8")
                entry = parser["Desktop Entry"]
            except (configparser.Error, KeyError, UnicodeDecodeError, OSError):
                continue
            if entry.get("Name"):
                names[path.stem.lower()] = entry["Name"]
                if entry.get("StartupWMClass"):
                    names[entry["StartupWMClass"].lower()] = entry["Name"]
    return names


def time_section(events, colors, start, end):
    days = collections.OrderedDict()
    for offset in range(7):
        day = start + dt.timedelta(days=offset)
        days[day.date().isoformat()] = collections.Counter()
    categories = collections.Counter()
    subcategories = collections.Counter()
    hours = [0.0] * 24
    apps = collections.Counter()
    for e in events:
        seconds = float(e.get("duration") or 0)
        path = e["data"].get("$category") or ["Uncategorized"]
        when = parse_time(e["timestamp"]).astimezone(start.tzinfo)
        day = (when - dt.timedelta(hours=start.hour)).date().isoformat()
        if day in days:
            days[day][path[0]] += seconds
        categories[path[0]] += seconds
        if len(path) > 1:
            subcategories[" › ".join(path[:2])] += seconds
        hours[when.hour] += seconds
        apps[e["data"].get("app") or "?"] += seconds

    names = desktop_names()
    total = sum(categories.values())
    busiest = max(days.items(), key=lambda item: sum(item[1].values())) if days else None
    return {
        "seconds": round(total),
        "categories": [{"name": n, "seconds": round(s), "color": color_for(n, colors)} for n, s in categories.most_common() if s >= 60],
        "subcategories": [{"name": n, "seconds": round(s)} for n, s in subcategories.most_common(6)],
        "days": [{"date": d, "seconds": round(sum(c.values())),
                  "segments": [{"name": n, "seconds": round(s), "color": color_for(n, colors)} for n, s in c.most_common() if s >= 60]}
                 for d, c in days.items()],
        "hours": [round(h) for h in hours],
        "busiestDay": busiest[0] if busiest else "",
        "apps": [{"name": names.get(a.lower(), a), "seconds": round(s)} for a, s in apps.most_common(6)],
        "switches": sum(1 for a, b in zip(events, events[1:]) if a["data"].get("app") != b["data"].get("app")),
        "longestFocus": longest_focus(events, "Work"),
    }


def longest_focus(events, category, gap_seconds=180):
    """Longest stretch in one category, allowing short excursions out of it."""
    best = (0.0, None)
    run_start = run_end = None
    for e in sorted(events, key=lambda e: e["timestamp"]):
        if (e["data"].get("$category") or [""])[0] != category:
            continue
        t0 = parse_time(e["timestamp"])
        t1 = t0 + dt.timedelta(seconds=float(e.get("duration") or 0))
        if run_end and (t0 - run_end).total_seconds() <= gap_seconds:
            run_end = max(run_end, t1)
        else:
            run_start, run_end = t0, t1
        length = (run_end - run_start).total_seconds()
        if length > best[0]:
            best = (length, run_start)
    return {"seconds": round(best[0]), "start": best[1].isoformat() if best[1] else ""}


# ---------------------------------------------------------------- anime

CRUNCHY = re.compile(r"^(?P<title>.+?) - Watch on Crunchyroll")
SERIES_PAGE = re.compile(r"^Watch (?P<title>.+?)(?: Series)? - Crunchyroll")


def raw_window_events(start, end):
    """Window events without the AFK filter: watching something is AFK by nature."""
    buckets = http_json(AW + "/api/0/buckets/")
    pool = [b for b in buckets.values() if b.get("type") == "currentwindow"]
    if not pool:
        return []
    bucket = max(pool, key=lambda b: b.get("last_updated") or "")["id"]
    query = urllib.parse.urlencode({"start": start.isoformat(), "end": end.isoformat(), "limit": 200000})
    return http_json(f"{AW}/api/0/buckets/{bucket}/events?{query}", timeout=60)


def anime_section(events):
    episodes = collections.Counter()
    series_pages = collections.Counter()
    for e in events:
        title = e["data"].get("title") or ""
        seconds = float(e.get("duration") or 0)
        match = CRUNCHY.match(title)
        if match:
            episodes[match["title"].strip()] += seconds
            continue
        page = SERIES_PAGE.match(title)
        if page:
            series_pages[page["title"].strip()] += seconds
    episodes = {t: s for t, s in episodes.items() if s >= 300}
    # Series are the shared leading words of their episode titles.
    groups = collections.defaultdict(list)
    titles = sorted(episodes)
    for title in titles:
        words = title.split()
        best = None
        for other in titles:
            if other == title:
                continue
            shared = 0
            for a, b in zip(words, other.split()):
                if a != b:
                    break
                shared += 1
            if shared >= 3 and (best is None or shared < best):
                best = shared
        groups[" ".join(words[:best]) if best else title].append(title)
    shows = []
    for series, eps in groups.items():
        series = re.sub(r"^(Season \d+|S\d+)\s+", "", series)
        seconds = sum(episodes[t] for t in eps)
        # Time on a series page ("Watch Rascal Does Not Dream Series") goes to
        # the show sharing the most words with it, and its name wins: episode
        # titles don't always start with the series ("Season 1 Cheering Up…").
        page = best_page(series, series_pages)
        if page:
            seconds += series_pages.pop(page)
            if not series.lower().startswith(page.lower()):
                series = page
        shows.append({"title": series, "episodes": len(eps), "seconds": round(seconds)})
    shows.sort(key=lambda s: s["seconds"], reverse=True)
    for show in shows[:3]:
        show.update(anilist_cover(show["title"]))
    return {"episodes": len(episodes), "seconds": round(sum(show["seconds"] for show in shows)), "shows": shows[:5]}


def words(text):
    return {w for w in re.findall(r"[a-z0-9']+", text.lower()) if len(w) > 2}


def best_page(series, pages):
    scored = [(len(words(series) & words(page)), page) for page in pages]
    scored = [item for item in scored if item[0] >= 3]
    return max(scored)[1] if scored else None


def anilist_cover(title):
    query = "query($s:String){Media(search:$s,type:ANIME){title{english romaji} coverImage{extraLarge color} bannerImage}}"
    try:
        media = http_json("https://graphql.anilist.co", {"query": query, "variables": {"s": title}}, timeout=10,
                          headers={"Accept": "application/json"})["data"]["Media"]
    except Exception:
        return {}
    return {"cover": data_url(media["coverImage"]["extraLarge"]), "color": media["coverImage"]["color"] or ""}


def data_url(url):
    """Inline an image, so WebGL can dither it on a page opened from file://."""
    import base64
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "omarchy-wrapped"})
        with urllib.request.urlopen(request, timeout=15) as response:
            kind = response.headers.get_content_type() or "image/jpeg"
            return f"data:{kind};base64," + base64.b64encode(response.read()).decode()
    except Exception:
        return ""


# ---------------------------------------------------------------- reading

def reading_section(events):
    pages = collections.Counter()
    for e in events:
        app = (e["data"].get("app") or "").lower()
        path = e["data"].get("$category") or [""]
        if app not in ("zen", "firefox", "chromium", "google-chrome") or path[0] in ("Communication",) or path[:2] == ["Media", "Social"]:
            continue
        title = re.sub(r"\s+[—-]\s+(Zen Browser|Mozilla Firefox|Chromium|Google Chrome)$", "", e["data"].get("title") or "").strip()
        if title and title.lower() not in ("new tab", "zen browser"):
            pages[title] += float(e.get("duration") or 0)
    return [{"title": t, "seconds": round(s)} for t, s in pages.most_common(5) if s >= 300]


# ------------------------------------------------------------------- code

def git_section(root, start, end):
    emails = set()
    try:
        emails.add(subprocess.run(["git", "config", "--global", "user.email"], capture_output=True, text=True).stdout.strip())
    except OSError:
        pass
    emails.discard("")
    seen = set()
    repos = collections.Counter()
    added = removed = 0
    hours = [0] * 24
    times = []
    for gitdir in sorted(set(Path(root).glob("*/.git")) | set(Path(root).glob("*/*/.git"))):
        repo = gitdir.parent
        args = ["git", "-C", str(repo), "log", "--all", "--no-merges", f"--since={start.isoformat()}",
                f"--until={end.isoformat()}", "--format=@%H %at %ae", "--numstat"]
        try:
            out = subprocess.run(args, capture_output=True, text=True, timeout=20).stdout
        except (OSError, subprocess.TimeoutExpired):
            continue
        current = None
        for line in out.splitlines():
            if line.startswith("@"):
                sha, stamp, email = line[1:].split(" ", 2)
                current = None
                if email not in emails or sha in seen:
                    continue
                seen.add(sha)
                current = sha
                name = repo.name if repo.parent == Path(root) else f"{repo.parent.name}/{repo.name}"
                repos[name] += 1
                when = dt.datetime.fromtimestamp(int(stamp)).astimezone()
                hours[when.hour] += 1
                times.append(when)
            elif current and line.strip():
                parts = line.split("\t")
                if len(parts) == 3 and parts[0].isdigit() and parts[1].isdigit():
                    added += int(parts[0])
                    removed += int(parts[1])
    latest = max(times, key=lambda t: (t.hour - 5) % 24) if times else None
    return {
        "commits": len(seen),
        "added": added,
        "removed": removed,
        "repos": [{"name": n, "commits": c} for n, c in repos.most_common(5)],
        "hours": hours,
        "latest": latest.isoformat() if latest else "",
    }


# ----------------------------------------------------------------- agents

def agents_section(start, end):
    db = Path(os.environ.get("XDG_DATA_HOME") or HOME / ".local/share") / "opencode" / "opencode.db"
    if not db.exists():
        return {}
    lo, hi = int(start.timestamp() * 1000), int(end.timestamp() * 1000)
    conn = sqlite3.connect(db.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)
    try:
        sessions = conn.execute(
            "select directory, count(*) from session_v2 where parent_id is null and time_created between ? and ? group by 1 order by 2 desc",
            (lo, hi)).fetchall()
        subagents = conn.execute(
            "select count(*) from session_v2 where parent_id is not null and time_created between ? and ?", (lo, hi)).fetchone()[0]
        models = collections.Counter()
        for (data,) in conn.execute(
                "select data from session_message where type='assistant' and time_created between ? and ?", (lo, hi)):
            try:
                d = json.loads(data)
            except ValueError:
                continue
            t = d.get("tokens") or {}
            cache = t.get("cache") or {}
            total = sum(int(t.get(k) or 0) for k in ("input", "output", "reasoning")) + int(cache.get("read") or 0) + int(cache.get("write") or 0)
            model = (d.get("model") or {}).get("id") or "unknown"
            models[model] += total
    finally:
        conn.close()

    def project(directory):
        p = Path(directory)
        return "~" if p == HOME else p.name

    projects = collections.Counter()
    for directory, count in sessions:
        projects[project(directory)] += count
    return {
        "sessions": sum(c for _, c in sessions),
        "subagents": subagents,
        "tokens": sum(models.values()),
        "models": [{"name": n, "tokens": t} for n, t in models.most_common(5)],
        "projects": [{"name": n, "sessions": c} for n, c in projects.most_common(5)],
    }


# ------------------------------------------------------------------- main

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weeks-ago", type=int, default=0)
    parser.add_argument("--day-start", type=int, default=4)
    parser.add_argument("--projects", default=str(HOME / "Programming"))
    args = parser.parse_args(argv)

    now = dt.datetime.now().astimezone().replace(microsecond=0)
    start, end = week_bounds(now, args.day_start, args.weeks_ago)
    record = {"start": start.isoformat(), "end": end.isoformat(), "generatedAt": now.isoformat(),
              "name": os.environ.get("USER", "")}
    try:
        events, colors = aw_events(start, end)
        record["time"] = time_section(events, colors, start, end)
        record["anime"] = anime_section(raw_window_events(start, end))
        record["reading"] = reading_section(events)
    except Exception as exc:  # ActivityWatch is optional
        record["timeError"] = str(exc)
    record["code"] = git_section(args.projects, start, end)
    record["agents"] = agents_section(start, end)
    json.dump(record, sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
