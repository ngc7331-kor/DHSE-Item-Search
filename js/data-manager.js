/**
 * Data Manager for Local PWA
 * Replaces code.gs functionality using LocalStorage
 */

const STORAGE_KEY = 'assist_items_data';

class DataManager {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  }

  saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
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

  addData(obj) {
    try {
      // Clean data
      const newItem = {
        종목: obj.종목 === '미입력' ? '' : obj.종목,
        영역: obj.영역 === '미입력' ? '' : obj.영역,
        순번: obj.순번 || '',
        품명: obj.품명 === '미입력' ? '' : obj.품명,
        수량: obj.수량 || '',
        위치: obj.위치 || '',
        사진: obj.사진 || '' // Base64 stored directly
      };
      
      this.data.push(newItem);
      this.saveData();
      return { success: true, message: '저장완료' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  updateData(old, n) {
    try {
      const idx = this.data.findIndex(d => d.순번 === old.순번 && d.종목 === old.종목);
      if (idx === -1) return { success: false, message: '데이터를 찾을 수 없습니다.' };
      
      this.data[idx] = {
        종목: n.종목 === '미입력' ? '' : n.종목,
        영역: n.영역 === '미입력' ? '' : n.영역,
        순번: n.순번, // 순번은 보통 바뀌지 않으나 로직상 유지
        품명: n.품명 === '미입력' ? '' : n.품명,
        수량: n.수량,
        위치: n.위치,
        사진: n.사진 || this.data[idx].사진
      };
      
      this.saveData();
      return { success: true, message: '수정 완료' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  deleteData(obj) {
    try {
      const idx = this.data.findIndex(d => d.순번 === obj.순번 && d.종목 === obj.종목);
      if (idx === -1) return { success: false, message: '삭제할 데이터를 찾을 수 없습니다.' };
      
      this.data.splice(idx, 1);
      this.saveData();
      return { success: true, message: '삭제 완료' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
}

// Global instance
const db = new DataManager();
