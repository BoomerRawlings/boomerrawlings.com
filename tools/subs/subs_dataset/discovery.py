"""Commons discovery uses original-file metadata, never search-result thumbnails."""

from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

from .io import DatasetError, USER_AGENT
from .pipeline import check_id, now


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def plain(value: str) -> str:
    parser = PlainText()
    parser.feed(value or "")
    return " ".join(html.unescape(" ".join(parser.parts)).split())


def durable_url(value: str) -> str:
    parts = urllib.parse.urlsplit(value)
    query = urllib.parse.urlencode([(key, item) for key, item in urllib.parse.parse_qsl(parts.query)
                                   if not key.lower().startswith("utm_")])
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, query, ""))


def license_policy(metadata: dict) -> dict:
    def value(key):
        field = metadata.get(key, {})
        return plain(field.get("value", "") if isinstance(field, dict) else str(field))
    short, code = value("LicenseShortName"), value("License")
    name = (short or code).strip()
    combined = (short + " " + code).lower()
    no_derivatives = bool(re.search(r"\bnd\b|no.?derivatives", combined))
    public_domain = "public domain" in combined or "cc0" in combined or code.lower() in {"pd", "pd-usgov", "pd-usgov-military"}
    creative_commons = "cc-by" in combined or "cc by" in combined
    noncommercial = bool(re.search(r"\bnc\b|noncommercial|non-commercial", combined))
    allowed = (public_domain or creative_commons) and not no_derivatives
    return {"tier": "research" if noncommercial else "commercial", "license": name or "unresolved",
            "download_allowed": allowed, "training_allowed": allowed, "redistribution_allowed": allowed,
            "attribution": value("Attribution") or value("Artist") or "Attribution requires review",
            "license_url": value("LicenseUrl"), "share_alike": "sa" in re.split(r"[\s-]+", combined)}


def discover_commons(class_id: str, query: str, *, limit: int = 100, max_requests: int = 10) -> tuple[list[dict], dict]:
    check_id(class_id)
    if not 1 <= limit <= 1000 or not 1 <= max_requests <= 100:
        raise DatasetError("Discovery requires1–1000 candidates and1–100 requests")
    rows = []
    continuation = {}
    requests = 0
    while len(rows) < limit and requests < max_requests:
        parameters = {"action": "query", "format": "json", "formatversion": 2, "generator": "search",
                      "gsrsearch": query, "gsrnamespace": 6, "gsrlimit": min(50, limit - len(rows)),
                      "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "maxlag": 5} | continuation
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(parameters)
        requests += 1
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=45) as response:
                raw = response.read(16 * 1024 * 1024 + 1)
                if len(raw) > 16 * 1024 * 1024:
                    raise DatasetError("Commons metadata response exceeds16MiB")
                payload = json.loads(raw)
        except (urllib.error.URLError, OSError, json.JSONDecodeError):
            raise DatasetError("Commons discovery unavailable; no candidate labels were accepted") from None
        if payload.get("error"):
            raise DatasetError("Commons returned an API error or rate limit; retry later")
        pages = payload.get("query", {}).get("pages", [])
        for page in pages:
            info = (page.get("imageinfo") or [{}])[0]
            if info.get("mime") not in {"image/jpeg", "image/png", "image/webp", "image/tiff"}:
                continue
            metadata = info.get("extmetadata", {})
            page_url = info.get("descriptionurl") or "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(page["title"].replace(" ", "_"))
            rights = license_policy(metadata)
            rights["evidence_url"] = page_url
            description = plain(metadata.get("ImageDescription", {}).get("value", ""))[:2000]
            rows.append({"class_id": class_id, "domain": "camera", "status": "candidate",
                         "source": {"page_url": page_url, "original_url": durable_url(info["url"]),
                                    "author": plain(metadata.get("Artist", {}).get("value", "")) or "unknown",
                                    "retrieved_at": now()}, "rights": rights,
                         "quality": {"original_width": info.get("width"), "original_height": info.get("height"),
                                     "subject_length_px": None, "original_resolution": True,
                                     "not_upscaled": False, "sharpness_ok": False},
                         "target_bbox": None, "event_group": None,
                         "discovery": {"provider": "wikimedia-commons", "query": query, "page_id": page.get("pageid"),
                                       "title": page.get("title"), "description": description,
                                       "date_text": plain(metadata.get("DateTimeOriginal", {}).get("value", "")),
                                       "classification_verified": False,
                                       "note": "Search results are candidates, not verified classes. Inspect original, rights, native target pixels, and capture event before acceptance."}})
            if len(rows) == limit:
                break
        continuation = payload.get("continue", {})
        if not continuation:
            break
    return rows, {"provider": "wikimedia-commons", "class_id": class_id, "candidates": len(rows),
                  "requests": requests, "original_urls_only": True, "class_labels_verified": False,
                  "continuation_available": bool(continuation)}
