# crawler

국내 도매/사입 사이트 상품을 수집해 `contracts/product.schema.json` 형식의 JSONL과
이미지를 내보내는 Python 앱이다. 공용 파이프라인과 오프라인 `demo` 어댑터까지 구현되어
있으며, 실제 공급처는 사이트별 어댑터와 로그인 설정을 추가하면 된다.

## 준비

- Python 3.12 이상
- [uv](https://docs.astral.sh/uv/)

```powershell
cd apps/crawler
uv sync
uv run pytest
```

계정 정보는 `.env` 또는 환경변수로만 관리한다. 실제 변수 이름은 추가할 어댑터에 맞춰
`.env.example`에 문서화하고, `.env` 파일은 Git에 커밋하지 않는다.

## CLI

```powershell
# 어댑터 로그인 후 쿠키를 .sessions/<site>.json에 보관
uv run crawler login <site>

# 검색 결과 URL만 확인
uv run crawler discover <site> --query "검색어" --limit 20

# 상세 페이지 한 건을 stdout의 JSON으로 확인
uv run crawler scrape <site> --url "https://supplier.example/product/123"

# 수집 실행
uv run crawler run <site> --query "검색어" --limit 20

# 기존 (site, sourceId)를 무시하고 다시 수집
uv run crawler run <site> --query "검색어" --limit 20 --refresh

# 이미 생성된 JSONL 계약 검증
uv run crawler validate out/<site>/<date>/products.jsonl
```

외부 네트워크 없이 전체 흐름을 확인하려면 다음을 실행한다. `*`는 demo 카탈로그 전체를
뜻한다.

```powershell
uv run crawler run demo --query "*" --limit 4 --refresh
```

출력은 다음 위치에 생긴다.

```text
out/<site>/<UTC 날짜>/products.jsonl
out/<site>/<UTC 날짜>/images/<sourceId>/<position>.<ext>
out/<site>/<UTC 날짜>/run.json
```

기본 HTTP 경로는 요청 간 1초, 최대 3회 시도, 네트워크/5xx만 재시도하며 성공 응답을
`.cache/`에 저장한다. 레코드 하나나 이미지 하나가 실패해도 나머지 상품 수집은 계속되고,
원인은 `run.json` 또는 레코드의 `warnings`에 남는다.

## 실제 사이트 어댑터 추가

`src/crawler/adapters/demo.py`를 참고해 `Adapter` 프로토콜의 네 메서드를 구현한다.

- `login(fetcher)`: 필요할 때만 로그인한다.
- `discover(fetcher, query, limit)`: 페이지네이션을 포함한 상품 URL을 반환한다.
- `parse(html, url)`: `SourcedProduct`를 반환한다.
- `id_of(url)`: 안정적인 원본 상품 ID를 반환한다.

어댑터는 `src/crawler/adapters/__init__.py`에 등록한다. 정상, 다중 옵션, 품절, 이미지 없음
HTML을 `tests/fixtures/<site>/`에 저장하고 네트워크 없는 파서 테스트를 먼저 추가한다.
약관, robots.txt, 이미지·설명 재사용 권한을 확인한 사이트만 연결해야 한다.

## 상품 계약

`src/crawler/core/models.py`의 Pydantic 모델이 계약의 원천이다. 모델을 바꾼 뒤 아래 명령으로
공유 스키마를 재생성하고 두 앱의 테스트를 함께 실행한다.

```powershell
uv run python scripts/export_schema.py
uv run pytest
cd ../lister
npm test
```
