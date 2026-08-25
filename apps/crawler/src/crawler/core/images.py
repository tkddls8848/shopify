from __future__ import annotations

import mimetypes
from pathlib import Path
from urllib.parse import urlparse

from crawler.core.fetch import FetchClient
from crawler.core.models import SourcedProduct


async def download_images(
    product: SourcedProduct,
    fetcher: FetchClient,
    destination: Path,
    repository_root: Path,
) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for image in product.images:
        try:
            response = await fetcher.get(str(image.sourceUrl))
            suffix = Path(urlparse(str(image.sourceUrl)).path).suffix
            if not suffix:
                suffix = mimetypes.guess_extension(response.headers.get("content-type", "").split(";")[0]) or ".bin"
            target = destination / f"{image.position}{suffix}"
            target.write_bytes(response.content)
            try:
                image.localPath = target.resolve().relative_to(repository_root.resolve()).as_posix()
            except ValueError:
                image.localPath = target.resolve().as_posix()
        except Exception as error:  # A product survives an individual image failure.
            product.warnings.append(f"image:{image.position}:download_failed:{type(error).__name__}")
