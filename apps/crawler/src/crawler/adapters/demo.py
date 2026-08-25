from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

from selectolax.parser import HTMLParser

from crawler.core.errors import ParseError
from crawler.core.fetch import FetchClient
from crawler.core.models import ProductImage, ProductOption, Source, SourcedProduct, Supply, Variant


class DemoAdapter:
    """Offline reference adapter. Replace selectors in a new adapter for a real supplier."""

    site = "demo"
    version = "1.0"
    concurrency = 2
    minimum_interval = 1.0

    @property
    def fixture_dir(self) -> Path:
        return Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "demo"

    async def login(self, fetcher: FetchClient) -> None:
        return None

    async def discover(self, fetcher: FetchClient, query: str, limit: int | None = None) -> list[str]:
        catalog_url = self.fixture_dir.joinpath("catalog.html").as_uri()
        tree = HTMLParser(await fetcher.get_text(catalog_url))
        result: list[str] = []
        needle = "" if query.strip() == "*" else query.casefold().strip()
        for node in tree.css("a.product-link"):
            title = node.text(strip=True)
            if needle and needle not in title.casefold():
                continue
            href = node.attributes.get("href")
            if href:
                result.append(self.fixture_dir.joinpath(href).resolve().as_uri())
            if limit is not None and len(result) >= limit:
                break
        return result

    def id_of(self, url: str) -> str:
        return Path(unquote(urlparse(url).path)).stem

    def parse(self, html: str, url: str) -> SourcedProduct:
        tree = HTMLParser(html)
        product = tree.css_first("#product")
        title_node = tree.css_first("h1")
        variants_node = tree.css_first("script#variants")
        if product is None or title_node is None or variants_node is None:
            raise ParseError(f"required product nodes are missing: {url}")

        try:
            raw_variants = json.loads(variants_node.text())
            options_node = tree.css_first("script#options")
            raw_options = json.loads(options_node.text()) if options_node else []
        except json.JSONDecodeError as error:
            raise ParseError(f"invalid embedded product JSON: {url}: {error}") from error

        warnings: list[str] = []
        images: list[ProductImage] = []
        for position, image in enumerate(tree.css("img.product-image")):
            source_url = image.attributes.get("src")
            if source_url:
                images.append(
                    ProductImage(
                        sourceUrl=urljoin(url, source_url),
                        position=position,
                        role="main" if position == 0 else "gallery",
                        alt=image.attributes.get("alt"),
                    )
                )
        if not images:
            warnings.append("images:unavailable")

        category = [node.text(strip=True) for node in tree.css(".breadcrumbs span")]
        description = tree.css_first(".description")
        shipping = tree.css_first(".shipping-fee")
        return SourcedProduct(
            schemaVersion=1,
            source=Source(
                site=self.site,
                sourceId=product.attributes.get("data-source-id") or self.id_of(url),
                url=url,
                scrapedAt=datetime.now(UTC),
                adapterVersion=self.version,
            ),
            title=title_node.text(strip=True),
            descriptionHtml=description.html if description else None,
            brand=product.attributes.get("data-brand"),
            sourceCategory=category,
            options=[ProductOption.model_validate(option) for option in raw_options],
            variants=[Variant.model_validate(variant) for variant in raw_variants],
            images=images,
            supply=Supply(
                moq=int(product.attributes["data-moq"]) if product.attributes.get("data-moq") else None,
                shippingFeeText=shipping.text(strip=True) if shipping else None,
                origin=product.attributes.get("data-origin"),
                sellerName=product.attributes.get("data-seller"),
            ),
            warnings=warnings,
        )
