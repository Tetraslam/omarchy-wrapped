import datetime as dt
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("collect", Path(__file__).resolve().parents[1] / "collect.py")
collect = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collect)

UTC = dt.timezone.utc
T0 = dt.datetime(2026, 10, 20, 12, tzinfo=UTC)


def event(minute, seconds, category=("Work",), title="", app="ghostty"):
    return {"timestamp": (T0 + dt.timedelta(minutes=minute)).isoformat(), "duration": seconds,
            "data": {"app": app, "title": title, "$category": list(category)}}


class Week(unittest.TestCase):
    def test_week_ends_with_today(self):
        now = dt.datetime(2026, 10, 20, 19, tzinfo=UTC)
        start, end = collect.week_bounds(now, 4, 0)
        self.assertEqual(start, dt.datetime(2026, 10, 14, 4, tzinfo=UTC))
        self.assertEqual(end, now)

    def test_before_day_start_belongs_to_yesterday(self):
        start, _ = collect.week_bounds(dt.datetime(2026, 10, 20, 2, tzinfo=UTC), 4, 1)
        self.assertEqual(start, dt.datetime(2026, 10, 6, 4, tzinfo=UTC))


class Focus(unittest.TestCase):
    def test_short_breaks_join_a_run(self):
        events = [event(0, 600), event(12, 600), event(60, 300), event(5, 60, ("Media",))]
        self.assertEqual(collect.longest_focus(events, "Work")["seconds"], 22 * 60)


class Anime(unittest.TestCase):
    def test_episodes_group_into_series_with_series_page_time(self):
        crunchy = lambda t: f"{t} - Watch on Crunchyroll — Mozilla Firefox"
        events = [
            event(0, 1400, title=crunchy("Rascal Does Not Dream of Bunny Girl Senpai Sister Panic")),
            event(30, 1400, title=crunchy("Rascal Does Not Dream of Bunny Girl Senpai The Kaede Quest")),
            event(60, 600, title="Watch Rascal Does Not Dream Series - Crunchyroll — Mozilla Firefox"),
            event(90, 1400, title=crunchy("Season 1 Cheering Up Behind the Supermarket with You")),
            event(120, 400, title="Watch Smoking Behind the Supermarket with You - Crunchyroll"),
            event(150, 60, title=crunchy("Trailer")),
        ]
        collect.anilist_cover = lambda title: {}
        anime = collect.anime_section(events)
        self.assertEqual(anime["episodes"], 3)
        shows = {s["title"]: s for s in anime["shows"]}
        self.assertEqual(shows["Rascal Does Not Dream of Bunny Girl Senpai"]["seconds"], 3400)
        self.assertEqual(shows["Smoking Behind the Supermarket with You"]["episodes"], 1)


class Reading(unittest.TestCase):
    def test_browser_pages_without_social_or_chat(self):
        events = [
            event(0, 900, ("Knowledge",), "AGI Ruin — LessWrong — Zen Browser", "zen"),
            event(20, 900, ("Media", "Social"), "Home / X — Zen Browser", "zen"),
            event(40, 900, ("Communication",), "WhatsApp — Zen Browser", "zen"),
        ]
        self.assertEqual([r["title"] for r in collect.reading_section(events)], ["AGI Ruin — LessWrong"])


if __name__ == "__main__":
    unittest.main()
