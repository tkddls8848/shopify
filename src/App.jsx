import { useMemo, useState } from 'react'
import {
  Archive, ArrowDownRight, ArrowUpRight, BarChart3, Bell, Box, Check,
  ChevronDown, ChevronRight, CircleHelp, Clock3, CreditCard, Download,
  Home, LayoutGrid, Menu, MoreHorizontal, Package, Plus, Search, Settings,
  ShoppingBag, SlidersHorizontal, Store, Tag, Truck, UserRound, Users, X,
} from 'lucide-react'

const products = [
  { id: 1, name: '소프트 울 카디건', category: '아우터', price: 89000, stock: 24, sold: 142, status: '판매중', tone: 'cream', initials: 'KN' },
  { id: 2, name: '레더 미니 토트백', category: '가방', price: 128000, stock: 8, sold: 98, status: '재고부족', tone: 'brown', initials: 'BG' },
  { id: 3, name: '클래식 와이드 데님', category: '팬츠', price: 72000, stock: 31, sold: 87, status: '판매중', tone: 'blue', initials: 'DN' },
  { id: 4, name: '실크 스퀘어 스카프', category: '액세서리', price: 46000, stock: 0, sold: 64, status: '품절', tone: 'olive', initials: 'SC' },
  { id: 5, name: '코튼 오버핏 셔츠', category: '상의', price: 59000, stock: 17, sold: 53, status: '판매중', tone: 'sky', initials: 'SH' },
]

const initialOrders = [
  { id: '#MR-1048', customer: '김하늘', initials: '김', item: '소프트 울 카디건 외 1건', amount: 148000, date: '오늘 14:32', status: '배송 준비' },
  { id: '#MR-1047', customer: '이서준', initials: '이', item: '레더 미니 토트백', amount: 128000, date: '오늘 13:18', status: '결제 완료' },
  { id: '#MR-1046', customer: '박지우', initials: '박', item: '클래식 와이드 데님', amount: 72000, date: '오늘 11:05', status: '배송 중' },
  { id: '#MR-1045', customer: '정유나', initials: '정', item: '코튼 오버핏 셔츠 외 2건', amount: 169000, date: '어제 20:41', status: '배송 완료' },
  { id: '#MR-1044', customer: '최민준', initials: '최', item: '실크 스퀘어 스카프', amount: 46000, date: '어제 18:22', status: '취소' },
]

const customers = [
  { name: '김하늘', email: 'haneul.kim@example.com', orders: 8, spent: 684000, segment: 'VIP', joined: '2025. 01. 18' },
  { name: '정유나', email: 'yuna.j@example.com', orders: 6, spent: 512000, segment: '단골', joined: '2025. 03. 04' },
  { name: '이서준', email: 'seojun.lee@example.com', orders: 3, spent: 296000, segment: '일반', joined: '2025. 11. 22' },
  { name: '박지우', email: 'jiwoo.park@example.com', orders: 2, spent: 148000, segment: '일반', joined: '2026. 02. 10' },
]

const chartData = [32, 44, 39, 58, 49, 67, 61, 75, 69, 84, 77, 94, 88, 102]
const won = (value) => `${value.toLocaleString('ko-KR')}원`

function Logo() {
  return <div className="logo"><div className="logo-mark"><span /></div><span>MORROW</span></div>
}

function Sidebar({ page, setPage, open, setOpen }) {
  const menus = [
    { group: '스토어', items: [['대시보드', Home], ['주문', ShoppingBag, 6], ['상품', Tag], ['고객', Users]] },
    { group: '인사이트', items: [['분석', BarChart3], ['마케팅', CreditCard]] },
    { group: '관리', items: [['앱 및 채널', LayoutGrid], ['설정', Settings]] },
  ]
  return <>
    {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="메뉴 닫기" />}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="side-top"><Logo /><button className="side-close" onClick={() => setOpen(false)}><X size={20} /></button></div>
      <button className="store-switch"><span className="store-icon"><Store size={17} /></span><span><strong>Morrow Seoul</strong><small>morrow-seoul.myshopify.com</small></span><ChevronDown size={16} /></button>
      <nav>
        {menus.map(({ group, items }) => <div className="nav-group" key={group}>
          <div className="nav-label">{group}</div>
          {items.map(([name, Icon, count]) => <button key={name} onClick={() => { setPage(name); setOpen(false) }} className={`nav-item ${page === name ? 'active' : ''}`}>
            <Icon size={18} strokeWidth={1.8} /><span>{name}</span>{count && <em>{count}</em>}
          </button>)}
        </div>)}
      </nav>
      <div className="side-footer"><div className="avatar dark">SJ</div><div><strong>서진아</strong><small>스토어 관리자</small></div><MoreHorizontal size={18} /></div>
    </aside>
  </>
}

function Header({ page, onMenu, onSearch }) {
  return <header className="header">
    <button className="mobile-menu" onClick={onMenu}><Menu size={21} /></button>
    <div className="breadcrumb"><span>스토어</span><ChevronRight size={14} /><strong>{page}</strong></div>
    <button className="search-trigger" onClick={onSearch}><Search size={17} /><span>검색</span><kbd>⌘ K</kbd></button>
    <div className="header-actions"><button><CircleHelp size={19} /></button><button className="notification"><Bell size={19} /><i /></button><div className="avatar">SJ</div></div>
  </header>
}

function MetricCard({ label, value, change, up, note, icon: Icon }) {
  return <article className="metric-card">
    <div className="metric-head"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-foot"><span className={up ? 'positive' : 'negative'}>{up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}</span><span>{note}</span></div>
  </article>
}

function SalesChart() {
  const width = 700, height = 190, max = 110
  const points = chartData.map((v, i) => `${(i / (chartData.length - 1)) * width},${height - (v / max) * height}`).join(' ')
  const area = `0,${height} ${points} ${width},${height}`
  return <div className="chart-wrap">
    <div className="chart-y"><span>120만</span><span>80만</span><span>40만</span><span>0</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="최근 매출 차트">
      <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34583f" stopOpacity=".2"/><stop offset="1" stopColor="#34583f" stopOpacity="0"/></linearGradient></defs>
      {[0, 1, 2, 3].map(i => <line key={i} x1="0" x2={width} y1={(height/3)*i} y2={(height/3)*i} className="grid-line" />)}
      <polygon points={area} fill="url(#areaFill)" />
      <polyline points={points} fill="none" stroke="#34583f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={(11 / 13) * width} cy={height - (94 / max) * height} r="5" fill="#fff" stroke="#34583f" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="chart-x"><span>8.12</span><span>8.15</span><span>8.18</span><span>8.21</span><span>8.24</span></div>
  </div>
}

function Dashboard({ setPage }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">2026년 8월 25일 화요일</p><h1>좋은 오후예요, 진아님</h1><p>오늘 스토어에서 일어난 일을 확인해보세요.</p></div><button className="date-button"><Clock3 size={16} />최근 14일<ChevronDown size={15} /></button></div>
    <section className="metrics-grid">
      <MetricCard label="총 매출" value="₩12,480,000" change="12.5%" up note="이전 기간 대비" icon={CreditCard} />
      <MetricCard label="주문" value="184" change="8.2%" up note="이전 기간 대비" icon={ShoppingBag} />
      <MetricCard label="방문자" value="3,842" change="4.1%" up note="이전 기간 대비" icon={Users} />
      <MetricCard label="전환율" value="3.24%" change="0.6%" note="이전 기간 대비" icon={BarChart3} />
    </section>
    <section className="dashboard-grid">
      <article className="panel sales-panel">
        <div className="panel-head"><div><h2>매출 추이</h2><p>지난 14일간의 총 매출</p></div><button className="dots"><MoreHorizontal size={19} /></button></div>
        <div className="sales-summary"><strong>₩12.48M</strong><span className="positive"><ArrowUpRight size={14}/>12.5%</span></div>
        <SalesChart />
      </article>
      <article className="panel progress-panel">
        <div className="panel-head"><div><h2>이번 달 목표</h2><p>8월 매출 목표 달성률</p></div><button className="dots"><MoreHorizontal size={19} /></button></div>
        <div className="donut" style={{'--progress': '74%'}}><div><strong>74%</strong><span>달성</span></div></div>
        <div className="goal-numbers"><div><span>현재 매출</span><strong>₩18.5M</strong></div><div><span>목표 매출</span><strong>₩25.0M</strong></div></div>
        <div className="goal-note"><span>목표까지</span><strong>₩6.5M 남음</strong></div>
      </article>
    </section>
    <section className="bottom-grid">
      <article className="panel orders-panel">
        <div className="panel-head"><div><h2>최근 주문</h2><p>새로 들어온 주문을 확인하세요.</p></div><button className="text-button" onClick={() => setPage('주문')}>전체 주문 보기<ChevronRight size={15} /></button></div>
        <OrderTable orders={initialOrders.slice(0, 4)} compact />
      </article>
      <article className="panel stock-panel">
        <div className="panel-head"><div><h2>재고 알림</h2><p>확인이 필요한 상품이에요.</p></div><span className="count-badge">3</span></div>
        {products.filter(p => p.stock < 10).map(p => <div className="stock-item" key={p.id}><ProductThumb product={p}/><div><strong>{p.name}</strong><span>{p.stock ? `재고 ${p.stock}개 남음` : '품절됨'}</span></div><button><ChevronRight size={17}/></button></div>)}
        <button className="stock-link" onClick={() => setPage('상품')}>재고 관리하기<ArrowUpRight size={15}/></button>
      </article>
    </section>
  </>
}

function StatusBadge({ status }) {
  const cls = status.replaceAll(' ', '')
  return <span className={`status ${cls}`}><i />{status}</span>
}

function ProductThumb({ product }) { return <div className={`product-thumb ${product.tone}`}><span>{product.initials}</span></div> }

function OrderTable({ orders, compact = false, onStatus }) {
  return <div className="table-scroll"><table><thead><tr><th>주문</th><th>고객</th><th>상품</th><th>결제 금액</th><th>상태</th>{!compact && <th />}</tr></thead><tbody>
    {orders.map(o => <tr key={o.id}><td><strong>{o.id}</strong><small>{o.date}</small></td><td><div className="customer-cell"><div className="mini-avatar">{o.initials}</div>{o.customer}</div></td><td className="muted">{o.item}</td><td><strong>{won(o.amount)}</strong></td><td>{onStatus ? <select className="status-select" value={o.status} onChange={e => onStatus(o.id, e.target.value)}><option>결제 완료</option><option>배송 준비</option><option>배송 중</option><option>배송 완료</option><option>취소</option></select> : <StatusBadge status={o.status}/>}</td>{!compact && <td><button className="dots"><MoreHorizontal size={18}/></button></td>}</tr>)}
  </tbody></table></div>
}

function ProductsPage({ onToast }) {
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [list, setList] = useState(products)
  const filtered = list.filter(p => p.name.includes(query) || p.category.includes(query))
  const addProduct = (e) => {
    e.preventDefault(); const form = new FormData(e.currentTarget)
    const item = { id: Date.now(), name: form.get('name'), category: form.get('category'), price: Number(form.get('price')), stock: Number(form.get('stock')), sold: 0, status: '판매중', tone: 'cream', initials: 'NEW' }
    setList([item, ...list]); setModal(false); onToast('새 상품이 등록되었습니다.')
  }
  return <>
    <PageTitle title="상품" desc={`전체 ${list.length}개 상품을 관리하고 재고를 확인하세요.`} action={<button className="primary" onClick={() => setModal(true)}><Plus size={17}/>상품 등록</button>} />
    <div className="summary-strip"><div><span>판매 중</span><strong>42</strong></div><div><span>재고 부족</span><strong className="amber">3</strong></div><div><span>품절</span><strong className="red">1</strong></div><div><span>전체 재고 가치</span><strong>₩8,420,000</strong></div></div>
    <section className="panel data-panel"><Toolbar query={query} setQuery={setQuery} placeholder="상품명 또는 카테고리 검색" />
      <div className="table-scroll"><table><thead><tr><th><input type="checkbox"/></th><th>상품</th><th>상태</th><th>재고</th><th>판매가</th><th>판매량</th><th /></tr></thead><tbody>
        {filtered.map(p => <tr key={p.id}><td><input type="checkbox"/></td><td><div className="product-cell"><ProductThumb product={p}/><div><strong>{p.name}</strong><small>{p.category} · SKU MR-{String(p.id).padStart(4,'0')}</small></div></div></td><td><StatusBadge status={p.status}/></td><td><strong className={p.stock < 10 ? 'low-stock' : ''}>{p.stock}개</strong></td><td>{won(p.price)}</td><td>{p.sold}</td><td><button className="dots"><MoreHorizontal size={18}/></button></td></tr>)}
      </tbody></table></div>
    </section>
    {modal && <Modal title="새 상품 등록" onClose={() => setModal(false)}><form onSubmit={addProduct} className="form-grid"><label className="full">상품명<input name="name" required placeholder="상품명을 입력하세요"/></label><label>카테고리<select name="category"><option>상의</option><option>아우터</option><option>팬츠</option><option>가방</option><option>액세서리</option></select></label><label>판매가<input name="price" type="number" required placeholder="0"/></label><label>초기 재고<input name="stock" type="number" required placeholder="0"/></label><div className="form-actions full"><button type="button" className="secondary" onClick={() => setModal(false)}>취소</button><button className="primary">등록하기</button></div></form></Modal>}
  </>
}

function OrdersPage({ onToast }) {
  const [orders, setOrders] = useState(initialOrders)
  const [query, setQuery] = useState('')
  const filtered = orders.filter(o => o.id.toLowerCase().includes(query.toLowerCase()) || o.customer.includes(query))
  const updateStatus = (id, status) => { setOrders(orders.map(o => o.id === id ? {...o, status} : o)); onToast(`${id} 주문 상태가 변경되었습니다.`) }
  return <><PageTitle title="주문" desc="결제부터 배송 완료까지 주문을 관리하세요." action={<button className="secondary"><Download size={16}/>내보내기</button>} />
    <div className="filter-tabs"><button className="active">전체 <span>184</span></button><button>미처리 <span>6</span></button><button>배송 중 <span>12</span></button><button>완료 <span>156</span></button><button>취소 <span>10</span></button></div>
    <section className="panel data-panel"><Toolbar query={query} setQuery={setQuery} placeholder="주문 번호 또는 고객명 검색"/><OrderTable orders={filtered} onStatus={updateStatus}/></section>
  </>
}

function CustomersPage() {
  const [query, setQuery] = useState('')
  const filtered = customers.filter(c => c.name.includes(query) || c.email.includes(query))
  return <><PageTitle title="고객" desc="고객 관계와 구매 활동을 한 곳에서 확인하세요." action={<button className="secondary"><Download size={16}/>고객 내보내기</button>} />
    <section className="customer-insights"><div><span>전체 고객</span><strong>1,248</strong><small><b>+8.4%</b> 지난달 대비</small></div><div><span>재구매율</span><strong>31.8%</strong><small><b>+2.1%</b> 지난달 대비</small></div><div><span>평균 주문액</span><strong>₩67,826</strong><small><b>+5.6%</b> 지난달 대비</small></div></section>
    <section className="panel data-panel"><Toolbar query={query} setQuery={setQuery} placeholder="고객명 또는 이메일 검색"/><div className="table-scroll"><table><thead><tr><th>고객</th><th>등급</th><th>주문</th><th>총 구매액</th><th>가입일</th><th/></tr></thead><tbody>{filtered.map(c => <tr key={c.email}><td><div className="customer-profile"><div className="avatar">{c.name[0]}</div><div><strong>{c.name}</strong><small>{c.email}</small></div></div></td><td><span className={`segment ${c.segment}`}>{c.segment}</span></td><td>{c.orders}회</td><td><strong>{won(c.spent)}</strong></td><td className="muted">{c.joined}</td><td><button className="dots"><MoreHorizontal size={18}/></button></td></tr>)}</tbody></table></div></section>
  </>
}

function AnalyticsPage() {
  return <><PageTitle title="분석" desc="스토어 성과와 고객 행동을 분석하세요." action={<button className="date-button"><Clock3 size={16}/>최근 30일<ChevronDown size={15}/></button>} />
    <section className="metrics-grid"><MetricCard label="순매출" value="₩24.8M" change="15.2%" up note="지난달 대비" icon={CreditCard}/><MetricCard label="평균 주문액" value="₩67,826" change="5.6%" up note="지난달 대비" icon={ShoppingBag}/><MetricCard label="반품률" value="2.4%" change="0.3%" up note="지난달 대비" icon={Archive}/><MetricCard label="신규 고객" value="284" change="11.8%" up note="지난달 대비" icon={UserRound}/></section>
    <section className="dashboard-grid"><article className="panel sales-panel"><div className="panel-head"><div><h2>매출 성과</h2><p>일별 매출 변화</p></div><span className="positive"><ArrowUpRight size={14}/>15.2%</span></div><div className="sales-summary"><strong>₩24.8M</strong></div><SalesChart/></article><article className="panel channel-panel"><div className="panel-head"><div><h2>판매 채널</h2><p>채널별 매출 비중</p></div></div>{[['온라인 스토어',68,'#355940'],['인스타그램',19,'#9a6845'],['네이버 쇼핑',9,'#7d907f'],['기타',4,'#c4c8bf']].map(([n,v,c])=><div className="channel" key={n}><div><span>{n}</span><strong>{v}%</strong></div><div className="bar"><i style={{width:`${v}%`,background:c}}/></div></div>)}</article></section>
  </>
}

function PlaceholderPage({ page }) { return <div className="empty-state"><div><Box size={28}/></div><h2>{page}</h2><p>이 메뉴는 데모에서 준비 중입니다.</p><button className="primary">기능 살펴보기</button></div> }
function PageTitle({ title, desc, action }) { return <div className="page-heading compact"><div><h1>{title}</h1><p>{desc}</p></div>{action}</div> }
function Toolbar({ query, setQuery, placeholder }) { return <div className="toolbar"><label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={placeholder}/></label><button className="secondary"><SlidersHorizontal size={16}/>필터</button></div> }
function Modal({ title, children, onClose }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X size={20}/></button></div>{children}</div></div> }

function CommandMenu({ onClose, setPage }) {
  const pages = ['대시보드','주문','상품','고객','분석','마케팅','설정']
  const [q,setQ]=useState(''); const list=pages.filter(p=>p.includes(q))
  return <div className="modal-backdrop command-backdrop" onMouseDown={onClose}><div className="command" onMouseDown={e=>e.stopPropagation()}><div className="command-input"><Search size={19}/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="메뉴, 주문, 상품 검색..."/><kbd>ESC</kbd></div><div className="command-list"><span>빠른 이동</span>{list.map(p=><button key={p} onClick={()=>{setPage(p);onClose()}}><Search size={16}/>{p}<ChevronRight size={16}/></button>)}</div></div></div>
}

export default function App() {
  const [page, setPage] = useState('대시보드')
  const [sidebar, setSidebar] = useState(false)
  const [search, setSearch] = useState(false)
  const [toast, setToast] = useState('')
  useMemo(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true) } if(e.key==='Escape') setSearch(false) }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [])
  const showToast = (message) => { setToast(message); window.setTimeout(()=>setToast(''),2600) }
  const content = page === '대시보드' ? <Dashboard setPage={setPage}/> : page === '상품' ? <ProductsPage onToast={showToast}/> : page === '주문' ? <OrdersPage onToast={showToast}/> : page === '고객' ? <CustomersPage/> : page === '분석' ? <AnalyticsPage/> : <PlaceholderPage page={page}/>
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} open={sidebar} setOpen={setSidebar}/><div className="main-shell"><Header page={page} onMenu={()=>setSidebar(true)} onSearch={()=>setSearch(true)}/><main>{content}</main></div>{search&&<CommandMenu onClose={()=>setSearch(false)} setPage={setPage}/>}<div className={`toast ${toast?'show':''}`}><Check size={17}/>{toast}</div></div>
}
