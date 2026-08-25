from __future__ import annotations

import json
from pathlib import Path

from crawler.core.models import generated_contract_schema


def main() -> None:
    repository_root = Path(__file__).resolve().parents[3]
    contract = repository_root / "contracts" / "product.schema.json"
    contract.write_text(
        json.dumps(generated_contract_schema(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(contract)


if __name__ == "__main__":
    main()
