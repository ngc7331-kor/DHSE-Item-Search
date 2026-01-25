const SHEET_ID = '1dhP06nEO0yzJnunjsBjy4NftYTNpb53Ne6bkE8ypG_Y';
const SHEET_NAME = '목록';
const ADMIN_EMAIL = 'taeoh0311@gmail.com';
const DRIVE_FOLDER_NAME = '동해교육지원청 물품';
const DRIVE_SUBFOLDER_NAME = '보조기기 사진들';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('학습/보조기기 검색')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function checkAdmin() {
  return Session.getActiveUser().getEmail() === ADMIN_EMAIL;
}

function getAllData() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    // 헤더 제외하고 데이터 매핑
    return data.slice(1).map(row => ({
      종목: row[0] || '', 영역: row[1] || '', 순번: row[2] || '',
      품명: row[3] || '', 수량: row[4] || '', 위치: row[5] || '', 사진: row[6] || ''
    }));
  } catch(e) { return []; }
}

function getNextNumber(category) {
  const allData = getAllData();
  const prefix = category.substring(0, 2);
  const filtered = allData.filter(d => d.순번.startsWith(prefix));
  if (filtered.length === 0) return prefix + "-001";
  const numbers = filtered.map(d => {
    const parts = d.순번.split('-');
    return parts.length > 1 ? parseInt(parts[1]) : 0;
  });
  const nextNum = (Math.max(...numbers) + 1).toString().padStart(3, '0');
  return prefix + "-" + nextNum;
}

function savePhotoToDrive(base64Data, fileName) {
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data.split(',')[1]), 'image/jpeg', fileName + '.jpg');
    const folder = getOrCreateFolder(DRIVE_SUBFOLDER_NAME, getOrCreateFolder(DRIVE_FOLDER_NAME));
    const existing = folder.getFilesByName(fileName + '.jpg');
    while (existing.hasNext()) { existing.next().setTrashed(true); }
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?id=' + file.getId();
  } catch(e) { return ''; }
}

function getOrCreateFolder(name, p) {
  const parent = p || DriveApp;
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function addData(obj) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    const sCat = obj.종목 === '미입력' ? '' : obj.종목;
    const sArea = obj.영역 === '미입력' ? '' : obj.영역;
    const sItem = obj.품명 === '미입력' ? '' : obj.품명;

    let photoUrl = (obj.사진 && obj.사진.startsWith('data:image')) ? savePhotoToDrive(obj.사진, sCat + '_' + obj.순번) : obj.사진;
    let lastIndex = data.length;
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === sCat) { lastIndex = i + 1; break; }
    }
    sheet.insertRowAfter(lastIndex);
    sheet.getRange(lastIndex + 1, 1, 1, 7).setValues([[sCat, sArea, obj.순번, sItem, obj.수량, obj.위치, photoUrl]]);
    return { success: true, message: '저장완료' };
  } catch(e) { return { success: false, message: e.message }; }
}

function updateData(old, n) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  const sCat = n.종목 === '미입력' ? '' : n.종목;
  const oldCat = old.종목 === '미입력' ? '' : old.종목;
  const sArea = n.영역 === '미입력' ? '' : n.영역;
  const sItem = n.품명 === '미입력' ? '' : n.품명;

  let url = (n.사진 && n.사진.startsWith('data:image')) ? savePhotoToDrive(n.사진, sCat + '_' + n.순번) : n.사진;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === oldCat && data[i][2] === old.순번) {
      sheet.getRange(i+1, 1, 1, 7).setValues([[sCat, sArea, n.순번, sItem, n.수량, n.위치, url]]);
      return { success: true, message: '수정 완료' };
    }
  }
}

function deleteData(obj) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const targetCat = obj.종목 === '미입력' ? '' : obj.종목;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === targetCat && data[i][2] === obj.순번) {
      sheet.deleteRow(i + 1);
      return { success: true, message: '삭제 완료' };
    }
  }
}

function searchData(c, a, i) {
  return getAllData().filter(d => {
    const matchCat = (c === '전체' || !c) ? true : (c === '미입력' ? d.종목 === '' : d.종목 === c);
    const matchArea = (a === '전체' || !a) ? true : (a === '미입력' ? d.영역 === '' : d.영역 === a);
    const dataItemName = d.품명 === '' ? '미입력' : d.품명;
    const matchItem = (i === '전체' || !i) ? true : dataItemName.includes(i);
    return matchCat && matchArea && matchItem;
  });
}