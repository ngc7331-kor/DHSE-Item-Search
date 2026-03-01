/**
 * UI Logic for PWA
 * Connects index.html to DataManager (db)
 */

let isAdmin = false; 
let cache = { cats: [], areas: {}, items: {}, allAreas: [], allItems: [] };
let fullData = []; 
// masterData는 필터링용 원본
let currentRenderedData = []; 
let currentPage = 1; 
let currentMode = 'add'; 
let editD = null;
let isInitialLoad = true;

// PWA Install Prompt
let deferredPrompt;
const addBtn = document.createElement('button');
addBtn.id = 'installPwaBtn';
addBtn.style.display = 'none';
addBtn.textContent = '⬇️ 앱 설치하기';
addBtn.style.cssText = 'position:fixed; bottom:20px; left:20px; padding:10px 15px; background:#6366f1; color:white; border:none; border-radius:30px; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.2); z-index:9999; cursor:pointer;';
document.body.appendChild(addBtn);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  addBtn.style.display = 'block';
});

addBtn.addEventListener('click', (e) => {
  addBtn.style.display = 'none'; // Hide button immediately to prevent double clicks
  
  if (!deferredPrompt) {
    alert("앱 설치가 이미 되었거나, 현재 브라우저에서 지원하지 않을 수 있습니다.");
    return;
  }

  deferredPrompt.prompt();
  
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the A2HS prompt');
    } else {
      console.log('User dismissed the A2HS prompt');
      addBtn.style.display = 'block'; // Show again if dismissed
    }
    deferredPrompt = null;
  }).catch(err => {
    console.error(err);
    alert("설치 창을 띄우는 중 오류가 발생했습니다.");
    addBtn.style.display = 'block';
  });
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log('Service Worker Registered'));
}

// 자음 분리 함수
function getJamos(str) {
  const cho = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  const jung = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
  const jong = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  let res = "";
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 0xAC00 && c <= 0xD7A3) {
      const code = c - 0xAC00;
      res += cho[Math.floor(code / 588)] + jung[Math.floor((code % 588) / 28)] + jong[code % 28];
    } else { res += str[i]; }
  }
  return res;
}

function isMatch(text, query) {
  if (!query) return true;
  if (!text) return false;
  const t = text.toString(); const q = query.toString();
  return t.includes(q) || getJamos(t).includes(getJamos(q));
}

function customSort(a, b) {
  if (a === '미입력') return 1; if (b === '미입력') return -1;
  if (a === '전체') return -1; if (b === '전체') return 1;
  return a.toString().localeCompare(b.toString(), 'ko-KR', { numeric: true });
}

// 배열을 무작위로 섞는 함수 추가
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

window.onload = () => { 
  try {
    preload(); setupDropdowns();
    // Listen for background updates
    window.addEventListener('data-updated', () => {
        console.log("Background update detected, refreshing UI...");
        preload(); // Re-run preload to update UI with new data
        // Optionally show a toast message here specifically for "Data Updated"
    });
  } catch(e) { alert("초기화 오류: " + e.message); }
};

async function preload() {
  // DB Call (Async)
  try {
    const data = await db.loadData();
    
    const cleanData = data.map(d => ({
        ...d,
        종목: (d.종목 && d.종목.toString().trim()) || '미입력',
        영역: (d.영역 && d.영역.toString().trim()) || '미입력',
        품명: (d.품명 && d.품명.toString().trim()) || '미입력'
    }));
    
    // Cache building
    cache.cats = ['전체', ...new Set(cleanData.map(d => d.종목))].sort(customSort);
    cache.allAreas = ['전체', ...new Set(cleanData.map(d => d.영역))].sort(customSort);
    cache.allItems = ['전체', ...new Set(cleanData.map(d => d.품명))].sort(customSort);
    
    cache.cats.forEach(c => {
      if(c === '전체') return;
      const cD = cleanData.filter(d => d.종목 === c);
      cache.areas[c] = ['전체', ...new Set(cD.map(d => d.영역))].sort(customSort);
      cache.areas[c].forEach(a => {
        cache.items[c+'_'+a] = ['전체', ...new Set(cD.filter(d => d.영역 === a).map(d => d.품명))].sort(customSort);
      });
    });
  
    // v8: 종목별(교재교구-보조기기-진단평가도구) 및 순번순 정렬
    const categoryOrder = { '교재교구': 1, '보조기기': 2, '진단평가도구': 3 };
    fullData = cleanData.sort((a, b) => {
      const orderA = categoryOrder[a.종목] || 99;
      const orderB = categoryOrder[b.종목] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.순번 || '').localeCompare(b.순번 || '', undefined, { numeric: true, sensitivity: 'base' });
    });
    
    isInitialLoad = false;
    renderUI(); 
  } catch (e) {
    console.error("Preload Failed:", e);
    alert("데이터를 불러오는데 실패했습니다: " + e.message);
  } finally {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
  }
}

function setupDropdowns() {
  const bind = (id, lid, dataFn) => {
    const el = document.getElementById(id);
    const listEl = document.getElementById(lid);
    const isStrict = el.hasAttribute('readonly');

    const showFilteredList = () => {
      const val = el.value.trim();
      let items = dataFn();
      if (!isStrict && val) {
          items = items.filter(i => isMatch(i, val) && i !== '전체');
          if (items.length === 0) items = ['검색 결과 없음'];
      }
      listEl.innerHTML = items.map(i => `<div class="dropdown-item">${i}</div>`).join('');
      document.querySelectorAll('.dropdown-list').forEach(x => x.classList.remove('show'));
      listEl.classList.add('show');
      
      Array.from(listEl.children).forEach(child => {
        child.onclick = (e) => {
          e.stopPropagation();
          if (child.textContent === '검색 결과 없음') return;
          el.value = child.textContent;
          listEl.classList.remove('show');
          if (id === 'cat') { document.getElementById('area').value = ''; document.getElementById('item').value = ''; }
          // Async call simulation
          if (id === 'm_cat') { 
            const next = db.getNextNumber(el.value);
            document.getElementById('m_num').value = next;
          }
        };
      });
    };

    el.onclick = (e) => { e.stopPropagation(); if (!isStrict && el.value) el.value = ''; showFilteredList(); };
    if (!isStrict) el.oninput = () => showFilteredList();
  };

  bind('cat', 'catL', () => cache.cats);
  bind('area', 'areaL', () => {
    const c = document.getElementById('cat').value;
    return (c && c !== '전체' && cache.areas[c]) ? cache.areas[c] : cache.allAreas;
  });
  bind('item', 'itemL', () => {
    const c = document.getElementById('cat').value || '전체';
    const a = document.getElementById('area').value || '전체';
    if (c === '전체' && a === '전체') return cache.allItems;
    if (c !== '전체' && cache.items[c+'_'+a]) return cache.items[c+'_'+a];
    const filtered = db.getAllData().filter(d => (c==='전체'||d.종목===c) && (a==='전체'||d.영역===a)).map(d=>d.품명);
    return ['전체', ...new Set(filtered)].sort(customSort);
  });
  bind('m_cat', 'mCatL', () => cache.cats.filter(c => c !== '전체'));
  bind('m_area', 'mAreaL', () => cache.allAreas.filter(a => a !== '전체'));
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.form-group')) document.querySelectorAll('.dropdown-list').forEach(x => x.classList.remove('show'));
  });
}

function getInstantImgUrl(url) {
  if (!url) return '';
  
  try {
    let id = '';
    // Pattern 1: id=...
    if (url.includes('id=')) {
      const match = url.match(/id=([^&]+)/);
      if (match) id = match[1];
    } 
    // Pattern 2: /file/d/...
    else if (url.includes('/file/d/')) {
      const match = url.match(/\/file\/d\/([^\/]+)/);
      if (match) id = match[1];
    }

    if (id) {
      // Use thumbnail endpoint for reliability
      return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w800';
    }
  } catch(e) { console.log(e); }

  return url;
}

function performSearch() {
  isInitialLoad = false;
  const c = document.getElementById('cat').value || '전체';
  const a = document.getElementById('area').value || '전체';
  const i = document.getElementById('item').value || '전체';
  
  const data = db.searchData(c, a, i);
  
  const categoryOrder = { '교재교구': 1, '보조기기': 2, '진단평가도구': 3 };
  const sortedData = data.map(d => ({ 
      ...d, 
      종목: d.종목 || '미입력', 
      영역: d.영역 || '미입력', 
      품명: d.품명 || '미입력' 
  })).sort((a, b) => {
    const orderA = categoryOrder[a.종목] || 99;
    const orderB = categoryOrder[b.종목] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return (a.순번 || '').localeCompare(b.순번 || '', undefined, { numeric: true, sensitivity: 'base' });
  });
  
  fullData = sortedData;
  renderUI();
}

function renderUI() {
  const res = document.getElementById('results');
  const bar = document.getElementById('pagiBar');
  if (isInitialLoad) { res.innerHTML = ''; bar.style.display = 'none'; return; }

  const size = parseInt(document.getElementById('pageSize').value);
  const startIdx = (currentPage - 1) * size;
  const endIdx = startIdx + size;
  currentRenderedData = fullData.slice(startIdx, endIdx);

  if (currentRenderedData.length === 0) {
    res.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-sub);">검색 결과가 없습니다.</p>';
    bar.style.display = 'none';
    return;
  }

  res.innerHTML = '';
  currentRenderedData.forEach((d, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.onclick = function() { showDetailModal(idx); };

    // Simply show admin buttons if isAdmin is true (local check)
    const adminHtml = isAdmin ? `
      <div style="margin-top:8px">
        <button onclick="event.stopPropagation(); editItem(${idx})" style="font-size:11px; padding:3px 7px;">수정</button> 
        <button onclick="event.stopPropagation(); deleteItem(${idx})" style="font-size:11px; padding:3px 7px; color:red">삭제</button>
      </div>` : '';

    card.innerHTML = `<div class="img-box">
        <img src="${getInstantImgUrl(d.사진)}" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/ngc7331-kor/DHSE-Item-Search/main/icon-v9-512.png'">
      </div>
      <div class="info-box">
        <h3>${d.품명}</h3>
        <div class="info-grid">
          <div class="info-row"><b>종목</b><span class="val">${d.종목}</span></div>
          <div class="info-row"><b>영역</b><span class="val">${d.영역}</span></div>
          <div class="info-row"><b>순번</b><span class="val">${d.순번}</span></div>
          <div class="info-row"><b>수량</b><span class="val">${d.수량}</span></div>
          <div class="info-row full"><b>위치</b><span class="val">${d.위치}</span></div>
        </div>
        ${adminHtml}
      </div>`;
    res.appendChild(card);
  });

  bar.style.display = 'flex';
  const nums = document.getElementById('pagiNums');
  nums.innerHTML = '';
  const totalPages = Math.ceil(fullData.length / size);
  const startPage = Math.floor((currentPage - 1) / 10) * 10 + 1;
  const endPage = Math.min(startPage + 9, totalPages);
  if (startPage > 1) nums.innerHTML += `<button class="pagi-btn" onclick="changeP(${startPage-1})">이전</button>`;
  for (let p = startPage; p <= endPage; p++) {
    nums.innerHTML += `<button class="pagi-btn ${p===currentPage?'active':''}" onclick="changeP(${p})">${p}</button>`;
  }
  if (endPage < totalPages) nums.innerHTML += `<button class="pagi-btn" onclick="changeP(${endPage+1})">다음</button>`;
}

function showDetailModal(idx) {
  const d = currentRenderedData[idx];
  if (!d) return;
  document.getElementById('dt_img').src = getInstantImgUrl(d.사진);
  document.getElementById('dt_name').textContent = d.품명;
  document.getElementById('dt_cat').textContent = d.종목;
  document.getElementById('dt_area').textContent = d.영역;
  document.getElementById('dt_num').textContent = d.순번;
  document.getElementById('dt_loc').textContent = d.위치;
  document.getElementById('dt_qty').textContent = d.수량;
  document.getElementById('detailModal').classList.add('show');
}

function closeDetailModal() { document.getElementById('detailModal').classList.remove('show'); }

function changeP(p) { currentPage = p; renderUI(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function toggleAdmin() { 
  // Local simple toggle, no server check
  isAdmin = !isAdmin;
  document.querySelector('.admin-btn').classList.toggle('active');
  document.getElementById('addBtn').classList.toggle('show');
  renderUI();
}

function openModal() { 
  currentMode='add'; 
  document.getElementById('mTitle').textContent = '항목 추가'; 
  ['m_cat','m_area','m_num','m_item','m_qty','m_loc'].forEach(id => document.getElementById(id).value = ''); 
  document.getElementById('m_prev').style.display = 'none'; 
  document.getElementById('f_input').value = ''; // clear file input
  document.getElementById('modal').classList.add('show'); 
}
function closeModal() { document.getElementById('modal').classList.remove('show'); }

function editItem(idx) { 
  const d = currentRenderedData[idx];
  if (!d) return;
  currentMode = 'edit';
  editD = d; 
  document.getElementById('mTitle').textContent = '항목 수정'; 
  document.getElementById('m_cat').value = d.종목; 
  document.getElementById('m_area').value = d.영역; 
  document.getElementById('m_num').value = d.순번; 
  document.getElementById('m_item').value = d.품명;
  document.getElementById('m_qty').value = d.수량; 
  document.getElementById('m_loc').value = d.위치; 
  const img = getInstantImgUrl(d.사진); 
  if(img) { document.getElementById('m_prev').src = img; document.getElementById('m_prev').style.display = 'block'; }
  else { document.getElementById('m_prev').style.display = 'none'; }
  document.getElementById('modal').classList.add('show');
}

function previewImg(e) { 
  const file = e.target.files[0], reader = new FileReader();
  reader.onload = (ev) => { 
    const img = new Image(); 
    img.onload = () => { 
      const cvs = document.createElement('canvas');
      // Resize to save space
      const maxDim = 600; 
      const s = Math.min(maxDim/img.width, maxDim/img.height, 1);
      cvs.width = img.width * s;
      cvs.height = img.height * s;
      const ctx = cvs.getContext('2d'); 
      ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      
      const resData = cvs.toDataURL('image/jpeg', 0.8);
      document.getElementById('m_prev').src = resData; 
      document.getElementById('m_prev').style.display = 'block'; 
    }; 
    img.src = ev.target.result; 
  }; 
  if(file) reader.readAsDataURL(file);
}

async function saveData() { 
  const obj = { 
    종목: document.getElementById('m_cat').value, 
    영역: document.getElementById('m_area').value, 
    순번: document.getElementById('m_num').value, 
    품명: document.getElementById('m_item').value, 
    수량: document.getElementById('m_qty').value, 
    위치: document.getElementById('m_loc').value, 
    사진: document.getElementById('m_prev').style.display==='block' ? document.getElementById('m_prev').src : '' 
  };
  
  let res;
  if (currentMode === 'add') {
    res = await db.addData(obj);
  } else {
    res = await db.updateData(editD, obj);
  }
  
  if (res.success) {
    alert(res.message);
    closeModal();
    // No full reload to save bandwidth/speed, just rely on optimistic UI update or simple re-render
    // For syncing, one might call preload() again, but it takes time.
    // Let's call preload() to be safe and sync with server eventually, or just update UI.
    // For now, let's just re-render UI with optimistic data.
    preload(); 
  } else {
    alert(res.message);
  }
}

async function deleteItem(idx) { 
  const d = currentRenderedData[idx];
  if(confirm('삭제하시겠습니까?')) {
    const res = await db.deleteData(d);
    alert(res.message);
    preload();
  }
}
