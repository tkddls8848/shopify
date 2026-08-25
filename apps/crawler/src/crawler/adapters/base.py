from __future__ import annotations

from typing import Protocol

from crawler.core.fetch import FetchClient
from crawler.core.models import SourcedProduct


class Adapter(Protocol):
    site: str
    version: str
    concurrency: int
    minimum_interval: float

    async def login(self, fetcher: FetchClient) -> None: ...

    async def discover(self, fetcher: FetchClient, query: str, limit: int | None = None) -> list[str]: ...

    def parse(self, html: str, url: str) -> SourcedProduct: ...

    def id_of(self, url: str) -> str: ...
