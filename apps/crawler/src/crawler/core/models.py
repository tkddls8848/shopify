from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, field_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Source(ContractModel):
    site: str = Field(description="어댑터 식별자. 예: domeggook")
    sourceId: str = Field(description="원본 사이트의 상품 ID. site와 묶어 중복 판정 키가 된다.")
    url: AnyUrl
    scrapedAt: datetime
    adapterVersion: str | None = None

    @field_validator("scrapedAt")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("scrapedAt must include a timezone")
        return value


class ProductOption(ContractModel):
    name: str
    values: Annotated[list[str], Field(min_length=1)]


class Variant(ContractModel):
    sourceSku: str | None = None
    optionValues: list[str] = Field(description="options 순서와 1:1 대응. 옵션이 없으면 빈 배열.")
    wholesalePrice: Annotated[float, Field(ge=0, description="원본 사이트의 공급가. 판매가 계산은 리스터가 한다.")]
    listPrice: Annotated[float | None, Field(ge=0, description="원본 사이트가 노출하는 소비자가(있으면).")] = None
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    stock: Annotated[int | None, Field(ge=0, description="null은 '알 수 없음'이며 0(품절)과 구분된다.")] = None
    barcode: str | None = None


class ProductImage(ContractModel):
    sourceUrl: AnyUrl
    localPath: str | None = Field(default=None, description="크롤러가 내려받은 경우 저장 경로(리포 기준 상대경로).")
    position: Annotated[int, Field(ge=0)]
    role: Literal["main", "gallery", "detail"] = "gallery"
    alt: str | None = None


class Supply(ContractModel):
    moq: Annotated[int | None, Field(ge=1, description="최소주문수량.")] = None
    shippingFeeText: str | None = Field(default=None, description="배송비 표기 원문. 파싱하지 않는다.")
    leadTimeDays: Annotated[int | None, Field(ge=0)] = None
    origin: str | None = Field(default=None, description="원산지 표기.")
    sellerName: str | None = None


class SourcedProduct(ContractModel):
    """The single record exchanged between crawler and lister."""

    schemaVersion: Literal[1]
    source: Source
    title: Annotated[str, Field(min_length=1)]
    descriptionHtml: str | None = Field(default=None, description="원본 상세 설명 HTML. 정제는 리스터가 한다.")
    brand: str | None = None
    sourceCategory: list[str] = Field(default_factory=list, description="원본 사이트 기준 카테고리 경로. Shopify 카테고리 매핑은 리스터 책임.")
    options: list[ProductOption] = Field(default_factory=list, description="옵션 이름과 값 목록. 단일 상품이면 빈 배열.")
    variants: Annotated[list[Variant], Field(min_length=1)]
    images: list[ProductImage]
    supply: Supply | None = None
    warnings: list[str] = Field(default_factory=list, description="부분 추출 실패 등 리스터가 알아야 할 신호.")


def generated_contract_schema() -> dict[str, object]:
    schema = SourcedProduct.model_json_schema(mode="validation")
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["$id"] = "https://morrow.local/contracts/product.schema.json"
    schema["title"] = "SourcedProduct"
    schema["description"] = (
        "크롤러가 내보내고 리스터가 읽는 상품 레코드. 두 앱의 유일한 결합점이다. "
        "원본 사이트의 값을 그대로 담고, Shopify 형태로의 변환은 리스터가 담당한다."
    )
    return schema
