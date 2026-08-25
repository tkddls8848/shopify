# lister

`contracts/product.schema.json` 형식의 JSONL을 검증·변환한 뒤 Shopify Admin GraphQL API로
상품을 생성하거나 갱신하는 Node/TypeScript 앱이다. API 호출 없는 계획 확인, DRAFT 기본값,
Shopify custom ID 기반 멱등 업서트, 이미지 업로드, 재고 구분, 실행 리포트를 구현한다.

## 준비

- Node.js 22 이상
- Shopify custom app access token
- 상품 등록용 `write_products` 권한
- 재고를 설정할 때 location 조회와 inventory 관련 권한

```powershell
cd apps/lister
npm install
npm test
npm run build
```

`.env.example`을 참고해 환경변수를 설정한다. `.env`와 실제 토큰은 Git에 커밋하지 않는다.

```powershell
$env:SHOPIFY_STORE_DOMAIN = "your-store.myshopify.com"
$env:SHOPIFY_ADMIN_ACCESS_TOKEN = "shpat_..."
# 선택: 생략하면 첫 번째 location을 조회한다.
$env:SHOPIFY_LOCATION_ID = "gid://shopify/Location/123"
```

Admin GraphQL API 버전은 `2026-07`로 고정되어 있다. 버전을 올릴 때는
`src/shopify.ts`의 `SHOPIFY_API_VERSION`, GraphQL 입력, 테스트 응답을 함께 검토한다.

## CLI

개발 중에는 `npm run dev --` 뒤에 명령을 붙인다. 빌드 후에는
`node dist/src/cli.js`로 같은 명령을 실행할 수 있다.

```powershell
# JSON Schema와 Zod를 모두 통과하는지 확인
npm run dev -- validate samples/products.jsonl

# Shopify 호출 없이 가격, variants, 경고, 업서트 대상을 표로 확인
npm run dev -- plan samples/products.jsonl

# 기본 DRAFT 업서트
npm run dev -- push samples/products.jsonl --limit 10

# 명시적으로 ACTIVE 업서트
npm run dev -- push samples/products.jsonl --publish --limit 10

# 이전 실행 결과 확인
npm run dev -- report <runId>
```

`validate` 또는 `plan`은 Shopify를 호출하지 않는다. `push`도 파일 전체의 계약 검증이 먼저
통과하지 않으면 어떤 원격 쓰기도 하지 않는다. 실제 등록 전에는 항상 `plan`을 먼저 확인한다.

## 변환과 안전 규칙

`config/rules.json`에서 다음 값을 코드 변경 없이 조정할 수 있다.

- 기본·카테고리별 가격 배수
- 고정비, 최저 마진, 올림 단위
- 지원 통화
- 원본 카테고리 prefix별 Shopify taxonomy ID와 태그
- 설명 HTML 허용 태그와 속성

판매가는 다음 식과 최저 마진 하한 중 큰 값을 올림 단위로 올린다.

```text
ceil(max(공급가 × 배수 + 고정비, 공급가 + 최저마진) / 라운딩) × 라운딩
```

옵션 3개 또는 variants 2,048개를 넘거나, 옵션 조합·통화가 잘못된 상품은 자르지 않고
거부한다. `stock: null`은 재고 추적을 끄고, `stock: 0`은 추적을 켠 상태의 0으로 보낸다.

## 멱등성과 이미지

첫 `push`에서 Shopify PRODUCT용 `id` metafield 정의를 보장한다.

```text
namespace: sourcing
key:       source_key
value:     <site>:<sourceId>
```

각 상품은 이 custom ID로 조회한 뒤 `productSet`으로 원자적 업서트되므로 같은 JSONL을 다시
실행해도 상품이 중복 생성되지 않는다. 원격 이미지 URL은 Shopify가 가져가고,
`localPath`가 있는 이미지는 `stagedUploadsCreate`의 임시 대상에 먼저 업로드한다.

각 `push` 결과는 `runs/<runId>.json`에 저장된다. GraphQL 응답의 비용 예산이 낮으면 다음
요청 전에 복원 속도에 맞춰 대기하며, 상품은 기본적으로 순차 처리한다.
