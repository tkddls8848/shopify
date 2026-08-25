import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from crawler.core.models import SourcedProduct, generated_contract_schema

APP_ROOT = Path(__file__).resolve().parents[1]
CONTRACT = APP_ROOT.parents[1] / "contracts" / "product.schema.json"


def test_pydantic_is_contract_source() -> None:
    assert json.loads(CONTRACT.read_text(encoding="utf-8")) == generated_contract_schema()


def test_unknown_schema_version_is_rejected() -> None:
    with pytest.raises(ValidationError):
        SourcedProduct.model_validate(
            {
                "schemaVersion": 2,
                "source": {
                    "site": "demo",
                    "sourceId": "one",
                    "url": "https://example.com/one",
                    "scrapedAt": "2026-08-26T00:00:00Z",
                },
                "title": "test",
                "variants": [{"optionValues": [], "wholesalePrice": 1, "currency": "KRW"}],
                "images": [],
            }
        )
