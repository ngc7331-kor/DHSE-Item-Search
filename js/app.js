const API_URL = 'https://script.google.com/macros/s/AKfycbxxSnINrMCjHbQNhndAn6nxbcVVljtszQeymF4yHwK3SmoAORTP5_pN0NooCrZDX8efGg/exec';

class DataManager {
  constructor() { this.data = []; }
  async loadData() {
    const cached = localStorage.getItem('appData');
    if (cached) { try { const p = JSON.parse(cached); if(Array.isArray(p)) this.data = p; } catch (e) { localStorage.removeItem('appData'); } }
    return await this.fetchAndCache();
  }
  async fetchAndCache() {
    try {
      const response = await fetch(API_URL);
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        this.data = result.data; localStorage.setItem('appData', JSON.stringify(this.data));
        return this.data;
      } else { throw new Error(result.message || '데이터 로드 실패'); }
    } catch (e) { return this.data || []; }
  }
  getAllData() { return this.data; }
  searchData(c, a, i) {
    if(!Array.isArray(this.data)) return [];
    return this.data.filter(d => {
      const matchCat = (c === '전체' || !c) ? true : (c === '미입력' ? (!d.종목 || d.종목 === '') : d.종목 === c);
      const matchArea = (a === '전체' || !a) ? true : (a === '미입력' ? (!d.영역 || d.영역 === '') : d.영역 === a);
      const dataItemName = (d.품명 || '').trim() === '' ? '미입력' : d.품명;
      const matchItem = (i === '전체' || !i) ? true : isMatch(dataItemName, i);
      return matchCat && matchArea && matchItem;
    });
  }
  getNextNumber(category) {
    const prefix = category.substring(0, 2);
    const filtered = (this.data || []).filter(d => (d.순번 || '').startsWith(prefix));
    if (filtered.length === 0) return prefix + "-001";
    const numbers = filtered.map(d => { const parts = d.순번.split('-'); return parts.length > 1 ? parseInt(parts[1], 10) : 0; });
    const nextNum = (Math.max(...numbers) + 1).toString().padStart(3, '0');
    return prefix + "-" + nextNum;
  }
}

const db = new DataManager();
let isAdmin = false; 
let cache = { cats: [], areas: {}, items: {}, allAreas: [], allItems: [] };
let fullData = []; let currentRenderedData = []; let currentPage = 1; let isInitialLoad = true;

function getJamos(str) {
  if(!str) return "";
  const cho = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  const jung = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
  const jong = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  let res = "";
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 0xAC00 && c <= 0xD7A3) { const code = c - 0xAC00; res += cho[Math.floor(code / 588)] + jung[Math.floor((code % 588) / 28)] + jong[code % 28]; }
    else { res += str[i]; }
  }
  return res;
}

function isMatch(text, query) {
  if (!query) return true; if (!text) return false;
  const t = text.toString().toLowerCase(); const q = query.toString().toLowerCase();
  return t.includes(q) || getJamos(t).includes(getJamos(q));
}

function customSort(a, b) { if (a === '미입력') return 1; if (b === '미입력') return -1; if (a === '전체') return -1; if (b === '전체') return 1; return a.toString().localeCompare(b.toString(), 'ko-KR', { numeric: true }); }
function shuffleArray(array) { if(!Array.isArray(array)) return []; let newArr = [...array]; for (let i = newArr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newArr[i], newArr[j]] = [newArr[j], newArr[i]]; } return newArr; }

let isPreloading = false; let deferredPrompt;

window.onload = () => {
  console.log("App Loaded");
  const btn = document.getElementById('searchBtn');
  if (btn) {
    btn.addEventListener('click', (e) => { performSearch(); });
  }
  
  const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if(installBtn) installBtn.style.display = 'flex'; });
  if(installBtn) {
    installBtn.addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') { deferredPrompt = null; installBtn.style.display = 'none'; } } });
  }
  
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err)); }

  preload(); 
  setupDropdowns();
};

async function preload() {
  if (isPreloading) return; isPreloading = true;
  console.log("Preload started");
  const loader = document.getElementById('loadingOverlay');
  try {
    const data = await db.loadData();
    const cleanData = (data || []).map(d => ({ ...d, 종목: (d.종목 && d.종목.toString().trim()) || '미입력', 영역: (d.영역 && d.영역.toString().trim()) || '미입력', 품명: (d.품명 && d.품명.toString().trim()) || '미입력' }));
    cache.cats = ['전체', ...new Set(cleanData.map(d => d.종목))].sort(customSort);
    cache.allAreas = ['전체', ...new Set(cleanData.map(d => d.영역))].sort(customSort);
    cache.allItems = ['전체', ...new Set(cleanData.map(d => d.품명))].sort(customSort);
    cache.cats.forEach(c => {
      if(c === '전체') return;
      const cD = cleanData.filter(d => d.종목 === c);
      cache.areas[c] = ['전체', ...new Set(cD.map(d => d.영역))].sort(customSort);
      cache.areas[c].forEach(a => { cache.items[c+'_'+a] = ['전체', ...new Set(cD.filter(d => d.영역 === a).map(d => d.품명))].sort(customSort); });
    });
    fullData = shuffleArray(cleanData); isInitialLoad = false; renderUI();
    console.log("Preload finished");
  } catch (e) { console.error("Preload Error", e); }
  finally { if(loader) loader.style.display = 'none'; isPreloading = false; }
}

function setupDropdowns() {
  const bind = (id, lid, dataFn) => {
    const el = document.getElementById(id); const listEl = document.getElementById(lid); if(!el || !listEl) return;
    const isStrict = el.hasAttribute('readonly');
    const showFilteredList = () => {
      const val = el.value.trim(); let items = dataFn();
      if (!isStrict && val) { items = items.filter(i => isMatch(i, val) && i !== '전체'); if (items.length === 0) items = ['검색 결과 없음']; }
      listEl.innerHTML = items.map(i => `<div class="dropdown-item">${i}</div>`).join('');
      document.querySelectorAll('.dropdown-list').forEach(x => x.classList.remove('show')); listEl.classList.add('show');
      Array.from(listEl.children).forEach(child => { child.onclick = (e) => { e.stopPropagation(); if (child.textContent === '검색 결과 없음') return; el.value = child.textContent; listEl.classList.remove('show'); if (id === 'cat') { document.getElementById('area').value = ''; document.getElementById('item').value = ''; } }; });
    };
    el.onclick = (e) => { e.stopPropagation(); if (!isStrict && el.value) el.value = ''; showFilteredList(); };
    if (!isStrict) el.oninput = () => showFilteredList();
  };
  bind('cat', 'catL', () => cache.cats);
  bind('area', 'areaL', () => { const c = document.getElementById('cat').value; return (c && c !== '전체' && cache.areas[c]) ? cache.areas[c] : cache.allAreas; });
  bind('item', 'itemL', () => {
    const c = document.getElementById('cat').value || '전체'; const a = document.getElementById('area').value || '전체';
    if (c === '전체' && a === '전체') return cache.allItems;
    const filtered = db.getAllData().filter(d => (c==='전체'||d.종목===c) && (a==='전체'||d.영역===a)).map(d=>d.품명);
    return ['전체', ...new Set(filtered)].sort(customSort);
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.form-group')) document.querySelectorAll('.dropdown-list').forEach(x => x.classList.remove('show')); });
}

function getInstantImgUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    let id = ''; if (url.includes('id=')) { const m = url.match(/id=([^&]+)/); if (m) id = m[1]; } 
    else if (url.includes('/file/d/')) { const m = url.match(/\/file\/d\/([^\/]+)/); if (m) id = m[1]; }
    if (id) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w800';
  } catch(e) {}
  return url;
}

function performSearch() {
  currentPage = 1; isInitialLoad = false;
  const c = document.getElementById('cat').value || '전체'; const a = document.getElementById('area').value || '전체'; const i = document.getElementById('item').value || '전체';
  const data = db.searchData(c, a, i);
  const order = { '교재교구': 1, '보조기기': 2, '진단평가도구': 3 };
  const active = (c && c !== '전체') || (a && a !== '전체') || (i && i !== '전체');
  if (active) {
    fullData = data.map(d => ({ ...d, 종목: d.종목 || '미입력', 영역: d.영역 || '미입력', 품명: d.품명 || '미입력' })).sort((a, b) => { const oa = order[a.종목] || 99; const ob = order[b.종목] || 99; if (oa !== ob) return oa - ob; return (a.순번 || '').localeCompare(b.순번 || '', undefined, { numeric: true, sensitivity: 'base' }); });
  } else {
    fullData = shuffleArray(data.map(d => ({ ...d, 종목: d.종목 || '미입력', 영역: d.영역 || '미입력', 품명: d.품명 || '미입력' })));
  }
  renderUI(); alert("검색이 완료되었습니다. (검색 결과: " + fullData.length + "건)");
}

function renderUI() {
  const res = document.getElementById('results'); const bar = document.getElementById('pagiBar'); if(!res || !bar) return;
  if (isInitialLoad) { res.innerHTML = ''; bar.style.display = 'none'; return; }
  const size = parseInt(document.getElementById('pageSize').value) || 10;
  const startIdx = (currentPage - 1) * size;
  currentRenderedData = fullData.slice(startIdx, startIdx + size);
  if (currentRenderedData.length === 0) { res.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-sub);">검색 결과가 없습니다.</p>'; bar.style.display = 'none'; return; }
  res.innerHTML = '';
  currentRenderedData.forEach((d, idx) => {
    const card = document.createElement('div'); card.className = 'result-card'; card.onclick = () => showDetailModal(idx);
    card.innerHTML = `<div class="img-box"><img src="${getInstantImgUrl(d.사진)}" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/ngc7331-kor/DHSE-Item-Search/main/icon-v9-512.png'"></div><div class="info-box"><h3>${d.품명}</h3><div class="info-grid"><div class="info-row"><b>종목</b><span class="val">${d.종목}</span></div><div class="info-row"><b>영역</b><span class="val">${d.영역}</span></div><div class="info-row"><b>순번</b><span class="val">${d.순번}</span></div><div class="info-row"><b>수량</b><span class="val">${d.수량}</span></div><div class="info-row full"><b>위치</b><span class="val">${d.위치}</span></div></div></div>`;
    res.appendChild(card);
  });
  bar.style.display = 'flex'; const nums = document.getElementById('pagiNums'); nums.innerHTML = '';
  const totalPages = Math.ceil(fullData.length / size); const startPage = Math.floor((currentPage - 1) / 10) * 10 + 1; const endPage = Math.min(startPage + 9, totalPages);
  if (startPage > 1) { const b = document.createElement('button'); b.className='pagi-btn'; b.textContent='이전'; b.onclick=()=>changeP(startPage-1); nums.appendChild(b); }
  for (let p = startPage; p <= endPage; p++) { const b = document.createElement('button'); b.className=`pagi-btn ${p===currentPage?'active':''}`; b.textContent=p; b.onclick=()=>changeP(p); nums.appendChild(b); }
  if (endPage < totalPages) { const b = document.createElement('button'); b.className='pagi-btn'; b.textContent='다음'; b.onclick=()=>changeP(endPage+1); nums.appendChild(b); }
}

function showDetailModal(idx) {
  const d = currentRenderedData[idx]; if (!d) return;
  document.getElementById('dt_img').src = getInstantImgUrl(d.사진); document.getElementById('dt_name').textContent = d.품명; document.getElementById('dt_cat').textContent = d.종목; document.getElementById('dt_area').textContent = d.영역; document.getElementById('dt_num').textContent = d.순번; document.getElementById('dt_loc').textContent = d.위치; document.getElementById('dt_qty').textContent = d.수량;
  document.getElementById('detailModal').classList.add('show');
}

function closeDetailModal() { document.getElementById('detailModal').classList.remove('show'); }
function changeP(p) { currentPage = p; renderUI(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function toggleAdmin() { isAdmin = !isAdmin; document.querySelector('.admin-btn').classList.toggle('active'); alert("관리자 기능은 구글 앱스 스크립트 도구에서 직접 사용해 주세요."); }
