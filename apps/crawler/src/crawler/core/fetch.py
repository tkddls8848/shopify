from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx

from crawler.core.errors import FetchError

Sleep = Callable[[float], Awaitable[None]]


class RateLimiter:
    def __init__(self, minimum_interval: float = 1.0, sleep: Sleep = asyncio.sleep) -> None:
        self.minimum_interval = minimum_interval
        self._sleep = sleep
        self._lock = asyncio.Lock()
        self._next_request = 0.0

    async def wait(self) -> None:
        async with self._lock:
            delay = self._next_request - time.monotonic()
            if delay > 0:
                await self._sleep(delay)
            self._next_request = time.monotonic() + self.minimum_interval


class DiskCache:
    def __init__(self, root: Path) -> None:
        self.root = root

    def _paths(self, url: str) -> tuple[Path, Path]:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
        return self.root / f"{digest}.json", self.root / f"{digest}.body"

    def get(self, url: str) -> httpx.Response | None:
        metadata_path, body_path = self._paths(url)
        if not metadata_path.exists() or not body_path.exists():
            return None
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        return httpx.Response(
            status_code=metadata["status"],
            headers=metadata["headers"],
            content=body_path.read_bytes(),
            request=httpx.Request("GET", url),
        )

    def put(self, url: str, response: httpx.Response) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        metadata_path, body_path = self._paths(url)
        metadata_path.write_text(
            json.dumps({"status": response.status_code, "headers": dict(response.headers)}),
            encoding="utf-8",
        )
        body_path.write_bytes(response.content)


class FetchClient:
    def __init__(
        self,
        *,
        cache_dir: Path | None = None,
        minimum_interval: float = 1.0,
        max_attempts: int = 3,
        timeout: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Sleep = asyncio.sleep,
    ) -> None:
        self.cache = DiskCache(cache_dir) if cache_dir else None
        self.rate_limiter = RateLimiter(minimum_interval, sleep)
        self.max_attempts = max_attempts
        self._sleep = sleep
        self.client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            transport=transport,
            headers={"User-Agent": "morrow-crawler/0.1 (+respectful; contact store owner)"},
        )

    async def __aenter__(self) -> "FetchClient":
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self.client.aclose()

    async def get(self, url: str, *, use_cache: bool = True) -> httpx.Response:
        parsed = urlparse(url)
        if parsed.scheme == "file":
            path = Path(unquote(parsed.path.lstrip("/"))) if parsed.netloc else Path(unquote(parsed.path))
            if len(parsed.path) >= 3 and parsed.path[0] == "/" and parsed.path[2] == ":":
                path = Path(unquote(parsed.path[1:]))
            if not path.exists():
                raise FetchError(f"local fixture does not exist: {path}")
            return httpx.Response(200, content=path.read_bytes(), request=httpx.Request("GET", url))

        if use_cache and self.cache:
            cached = self.cache.get(url)
            if cached is not None:
                return cached

        last_error: Exception | None = None
        for attempt in range(1, self.max_attempts + 1):
            await self.rate_limiter.wait()
            try:
                response = await self.client.get(url)
                if 500 <= response.status_code < 600:
                    raise FetchError(f"server returned {response.status_code} for {url}")
                if response.status_code >= 400:
                    raise FetchError(f"non-retryable HTTP {response.status_code} for {url}")
                if use_cache and self.cache:
                    self.cache.put(url, response)
                return response
            except (httpx.TransportError, FetchError) as error:
                last_error = error
                retryable = isinstance(error, httpx.TransportError) or "server returned" in str(error)
                if not retryable or attempt == self.max_attempts:
                    break
                await self._sleep(0.25 * (2 ** (attempt - 1)))
        raise FetchError(f"failed to fetch {url} after {self.max_attempts} attempts: {last_error}") from last_error

    async def get_text(self, url: str, *, use_cache: bool = True) -> str:
        response = await self.get(url, use_cache=use_cache)
        return response.text
