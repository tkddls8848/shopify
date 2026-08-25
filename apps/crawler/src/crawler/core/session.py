from __future__ import annotations

import json
from pathlib import Path

from crawler.core.fetch import FetchClient


class SessionStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def path_for(self, site: str) -> Path:
        return self.root / f"{site}.json"

    def restore(self, site: str, fetcher: FetchClient) -> bool:
        path = self.path_for(site)
        if not path.exists():
            return False
        for cookie in json.loads(path.read_text(encoding="utf-8")):
            fetcher.client.cookies.set(
                cookie["name"], cookie["value"], domain=cookie.get("domain"), path=cookie.get("path", "/")
            )
        return True

    def save(self, site: str, fetcher: FetchClient) -> Path:
        self.root.mkdir(parents=True, exist_ok=True)
        cookies = [
            {"name": cookie.name, "value": cookie.value, "domain": cookie.domain, "path": cookie.path}
            for cookie in fetcher.client.cookies.jar
        ]
        path = self.path_for(site)
        path.write_text(json.dumps(cookies, ensure_ascii=False, indent=2), encoding="utf-8")
        return path
