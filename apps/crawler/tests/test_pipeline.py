import json
from pathlib import Path

import pytest

from crawler.adapters.demo import DemoAdapter
from crawler.core.fetch import FetchClient
from crawler.core.pipeline import Pipeline, validate_jsonl


@pytest.mark.asyncio
async def test_offline_pipeline_writes_jsonl_images_and_summary(tmp_path: Path) -> None:
    adapter = DemoAdapter()
    async with FetchClient(cache_dir=tmp_path / "cache", minimum_interval=0) as fetcher:
        pipeline = Pipeline(adapter, fetcher, tmp_path / "out", tmp_path)
        run_dir, summary = await pipeline.run(query="", limit=4)

    assert summary.succeeded == 4
    assert summary.failed == 0
    assert (run_dir / "run.json").exists()
    products = (run_dir / "products.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(products) == 4
    assert any(json.loads(line)["warnings"] == ["images:unavailable"] for line in products)
    assert len(list((run_dir / "images").glob("*/*.svg"))) == 4
    assert validate_jsonl(run_dir / "products.jsonl") == (4, [])


@pytest.mark.asyncio
async def test_pipeline_skips_existing_products(tmp_path: Path) -> None:
    adapter = DemoAdapter()
    async with FetchClient(minimum_interval=0) as fetcher:
        pipeline = Pipeline(adapter, fetcher, tmp_path / "out", tmp_path)
        await pipeline.run(query="", limit=1)
        _, second = await pipeline.run(query="", limit=1)
    assert second.skipped == 1
    assert second.succeeded == 0
