/**
 * Data Manager for API Integration
 * Connects to Google Apps Script Web App
 */

// User provided Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxxSnINrMCjHbQNhndAn6nxbcVVljtszQeymF4yHwK3SmoAORTP5_pN0NooCrZDX8efGg/exec';

class DataManager {
  constructor() {
    this.data = [];
  }

  // Load all data from Google Sheet
  async loadData() {
    try {
      const response = await fetch(API_URL);
      const result = await response.json();
      if (result.success) {
        this.data = result.data;
        return this.data;
      } else {
        throw new Error(result.message || '데이터 로드 실패');
      }
    } catch (e) {
      console.error("Load Error:", e);
      alert("데이터를 가져오는 중 오류가 발생했습니다.\n" + e.message + "\n\n(구글 앱스 스크립트 배포 권한 설정을 확인해주세요)");
      // Fallback or empty
      return [];
    }
  }

  getAllData() {
    return this.data;
  }

  // category: 종목, area: 영역, item: 품명
  searchData(c, a, i) {
    return this.data.filter(d => {
      const matchCat = (c === '전체' || !c) ? true : (c === '미입력' ? d.종목 === '' : d.종목 === c);
      const matchArea = (a === '전체' || !a) ? true : (a === '미입력' ? d.영역 === '' : d.영역 === a);
      const dataItemName = (d.품명 || '').trim() === '' ? '미입력' : d.품명;
      const matchItem = (i === '전체' || !i) ? true : dataItemName.includes(i);
      return matchCat && matchArea && matchItem;
    });
  }

  getNextNumber(category) {
    const prefix = category.substring(0, 2);
    const filtered = this.data.filter(d => (d.순번 || '').startsWith(prefix));
    
    if (filtered.length === 0) return prefix + "-001";
    
    const numbers = filtered.map(d => {
      const parts = d.순번.split('-');
      return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    });
    
    const nextNum = (Math.max(...numbers) + 1).toString().padStart(3, '0');
    return prefix + "-" + nextNum;
  }

  // Send add request to API
  async addData(obj) {
    try {
      const payload = {
        action: 'add',
        item: {
          종목: obj.종목 === '미입력' ? '' : obj.종목,
          영역: obj.영역 === '미입력' ? '' : obj.영역,
          순번: obj.순번 || '',
          품명: obj.품명 === '미입력' ? '' : obj.품명,
          수량: obj.수량 || '',
          위치: obj.위치 || '',
          사진: obj.사진 || ''
        }
      };
      
      const response = await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', // Google Apps Script POST limitation
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      // 'no-cors' mode means we can't read the response. 
      // We assume success if no network error.
      // To strictly verify, we would need a proper CORS setup or reload data.
      // For this simple app, we Optimistically update local data.
      
      this.data.push(payload.item);
      return { success: true, message: '저장 요청 완료 (새로고침 시 반영됩니다)' };
      
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // Send update request to API
  async updateData(old, n) {
    try {
      const payload = {
        action: 'update',
        oldItem: old,
        item: {
          종목: n.종목 === '미입력' ? '' : n.종목,
          영역: n.영역 === '미입력' ? '' : n.영역,
          순번: n.순번,
          품명: n.품명 === '미입력' ? '' : n.품명,
          수량: n.수량,
          위치: n.위치,
          사진: n.사진 || ''
        }
      };

      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      // Optimistic local update
      const idx = this.data.findIndex(d => d.순번 === old.순번 && d.종목 === old.종목);
      if (idx !== -1) {
          this.data[idx] = payload.item;
      }

      return { success: true, message: '수정 요청 완료 (새로고침 시 반영됩니다)' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // Send delete request to API
  async deleteData(obj) {
    try {
      const payload = {
        action: 'delete',
        item: obj
      };

      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Optimistic local update
      const idx = this.data.findIndex(d => d.순번 === obj.순번 && d.종목 === obj.종목);
      if (idx !== -1) this.data.splice(idx, 1);

      return { success: true, message: '삭제 요청 완료 (새로고침 시 반영됩니다)' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
}

// Global instance
const db = new DataManager();
