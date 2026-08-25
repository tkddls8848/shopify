from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from crawler.adapters.base import Adapter
from crawler.core.fetch import FetchClient
from crawler.core.images import download_images
from crawler.core.models import SourcedProduct


@dataclass
class RunError:
    url: str
    error: str


@dataclass
class RunSummary:
    site: str
    startedAt: str
    finishedAt: str | None = None
    succeeded: int = 0
    failed: int = 0
    skipped: int = 0
    errors: list[RunError] = field(default_factory=list)


class Pipeline:
    def __init__(self, adapter: Adapter, fetcher: FetchClient, output_root: Path, repository_root: Path) -> None:
        self.adapter = adapter
        self.fetcher = fetcher
        self.output_root = output_root
        self.repository_root = repository_root

    def _existing_keys(self) -> set[tuple[str, str]]:
        keys: set[tuple[str, str]] = set()
        site_root = self.output_root / self.adapter.site
        for path in site_root.glob("*/products.jsonl") if site_root.exists() else []:
            for line in path.read_text(encoding="utf-8").splitlines():
                try:
                    record = json.loads(line)
                    keys.add((record["source"]["site"], record["source"]["sourceId"]))
                except (json.JSONDecodeError, KeyError):
                    continue
        return keys

    async def scrape(self, url: str) -> SourcedProduct:
        html = await self.fetcher.get_text(url)
        return self.adapter.parse(html, url)

    async def run(self, query: str, limit: int | None = None, refresh: bool = False) -> tuple[Path, RunSummary]:
        started = datetime.now(UTC)
        run_dir = self.output_root / self.adapter.site / started.date().isoformat()
        run_dir.mkdir(parents=True, exist_ok=True)
        products_path = run_dir / "products.jsonl"
        summary = RunSummary(site=self.adapter.site, startedAt=started.isoformat())
        existing = set() if refresh else self._existing_keys()
        urls = await self.adapter.discover(self.fetcher, query, limit)

        with products_path.open("a", encoding="utf-8", newline="\n") as output:
            for url in urls:
                key = (self.adapter.site, self.adapter.id_of(url))
                if key in existing:
                    summary.skipped += 1
                    continue
                try:
                    product = await self.scrape(url)
                    await download_images(
                        product,
                        self.fetcher,
                        run_dir / "images" / product.source.sourceId,
                        self.repository_root,
                    )
                    validated = SourcedProduct.model_validate(product.model_dump(mode="json"))
                    output.write(json.dumps(validated.model_dump(mode="json"), ensure_ascii=False) + "\n")
                    output.flush()
                    summary.succeeded += 1
                    existing.add(key)
                except Exception as error:
                    summary.failed += 1
                    summary.errors.append(RunError(url=url, error=f"{type(error).__name__}: {error}"))

        summary.finishedAt = datetime.now(UTC).isoformat()
        (run_dir / "run.json").write_text(
            json.dumps(asdict(summary), ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return run_dir, summary


def validate_jsonl(path: Path) -> tuple[int, list[dict[str, Any]]]:
    valid = 0
    errors: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            SourcedProduct.model_validate_json(line)
            valid += 1
        except (ValidationError, ValueError) as error:
            errors.append({"line": line_number, "error": str(error)})
    return valid, errors
