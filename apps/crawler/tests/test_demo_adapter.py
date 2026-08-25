from pathlib import Path

import pytest

from crawler.adapters.demo import DemoAdapter

FIXTURES = Path(__file__).parent / "fixtures" / "demo"


@pytest.mark.parametrize(
    ("filename", "variant_count", "stock"),
    [
        ("normal.html", 1, 12),
        ("options.html", 4, 5),
        ("soldout.html", 1, 0),
        ("no-image.html", 1, None),
    ],
)
def test_parse_fixture_variants(filename: str, variant_count: int, stock: int | None) -> None:
    adapter = DemoAdapter()
    path = FIXTURES / filename
    product = adapter.parse(path.read_text(encoding="utf-8"), path.as_uri())
    assert product.source.sourceId == path.stem
    assert len(product.variants) == variant_count
    assert product.variants[0].stock == stock
    if filename == "no-image.html":
        assert product.images == []
        assert "images:unavailable" in product.warnings


def test_options_match_variant_values() -> None:
    adapter = DemoAdapter()
    path = FIXTURES / "options.html"
    product = adapter.parse(path.read_text(encoding="utf-8"), path.as_uri())
    assert [option.name for option in product.options] == ["색상", "사이즈"]
    assert product.variants[-1].optionValues == ["흰색", "L"]
