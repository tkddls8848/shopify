from pathlib import Path

import httpx
import pytest

from crawler.core.errors import FetchError
from crawler.core.fetch import FetchClient


async def no_sleep(_: float) -> None:
    return None


@pytest.mark.asyncio
async def test_retries_5xx_and_caches_success(tmp_path: Path) -> None:
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls < 3:
            return httpx.Response(503, request=request)
        return httpx.Response(200, text="ok", request=request)

    async with FetchClient(
        cache_dir=tmp_path,
        minimum_interval=0,
        transport=httpx.MockTransport(handler),
        sleep=no_sleep,
    ) as fetcher:
        assert await fetcher.get_text("https://supplier.test/product") == "ok"
        assert await fetcher.get_text("https://supplier.test/product") == "ok"
    assert calls == 3


@pytest.mark.asyncio
async def test_does_not_retry_4xx() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(401, request=request)

    async with FetchClient(
        minimum_interval=0,
        transport=httpx.MockTransport(handler),
        sleep=no_sleep,
    ) as fetcher:
        with pytest.raises(FetchError):
            await fetcher.get("https://supplier.test/private")
    assert calls == 1
