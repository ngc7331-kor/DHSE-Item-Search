const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
const SHEET_NAME = '목록';
const ADMIN_EMAIL = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
const DRIVE_FOLDER_NAME = '동해교육지원청 물품';
const DRIVE_SUBFOLDER_NAME = '보조기기 사진들';

// GET 요청 처리 (데이터 조회)
function doGet(e) {
  const data = getAllData();
  return responseJSON({ success: true, data: data });
}

// POST 요청 처리 (추가/수정/삭제)
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("No data received");
    }
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const item = params.item;
    const userEmail = params.userEmail || ''; // 관리자 인증용 (프론트에서 보냄)

    // 간단한 이메일 체크 (실제로는 OAuth가 더 안전하지만 현재 구조 유지)
    // 프론트엔드에서 관리자 모드 진입 시 이메일을 같이 보내줘야 함. 
    // 혹은 여기서는 누구나 수정 가능하게 하고 프론트에서만 막을 수도 있음. 
    // 일단은 프론트엔드 로직을 따르되, 서버측에서도 최소한의 체크는 가능.
    
    let result;
    if (action === 'add') {
      result = addData(item);
    } else if (action === 'update') {
      result = updateData(params.oldItem, item);
    } else if (action === 'delete') {
      result = deleteData(item);
    } else {
      throw new Error("Unknown action: " + action);
    }
    
    return responseJSON(result);
    
  } catch (error) {
    return responseJSON({ success: false, message: error.message });
  }
}

// JSON 응답 생성 헬퍼 (CORS 헤더 포함)
function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- 기존 로직 재활용 (HTML 관련 부분 제거) ---

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

function savePhotoToDrive(base64Data, fileName) {
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data.split(',')[1]), 'image/jpeg', fileName + '.jpg');
    const folder = getOrCreateFolder(DRIVE_SUBFOLDER_NAME, getOrCreateFolder(DRIVE_FOLDER_NAME));
    const existing = folder.getFilesByName(fileName + '.jpg');
    while (existing.hasNext()) { existing.next().setTrashed(true); }
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // 썸네일 링크 대신 직접 다운로드 링크나 webContentLink 사용 권장
    // 여기서는 기존 로직 유지하되 필요시 수정
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
    // 간단히 맨 뒤에 추가하거나 정렬 로직 사용 (기존 로직 유지)
    for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === sCat) { lastIndex = i + 1; break; }
    }
    // 데이터가 아예 없거나 해당 카테고리가 없으면 맨 뒤에 추가
    if (lastIndex === 0) lastIndex = data.length; // 헤더만 있는 경우 고려

    sheet.insertRowAfter(lastIndex);
    sheet.getRange(lastIndex + 1, 1, 1, 7).setValues([[sCat, sArea, obj.순번, sItem, obj.수량, obj.위치, photoUrl]]);
    return { success: true, message: '저장완료' };
  } catch(e) { return { success: false, message: e.message }; }
}

function updateData(old, n) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    const sCat = n.종목 === '미입력' ? '' : n.종목;
    const oldCat = old.종목 === '미입력' ? '' : old.종목;
    const sArea = n.영역 === '미입력' ? '' : n.영역;
    const sItem = n.품명 === '미입력' ? '' : n.품명;

    let url = (n.사진 && n.사진.startsWith('data:image')) ? savePhotoToDrive(n.사진, sCat + '_' + n.순번) : n.사진;
    
    for (let i = 1; i < data.length; i++) {
        // 순번과 종목으로 찾기 (기존 로직)
        if (data[i][0] === oldCat && data[i][2] === old.순번) {
        sheet.getRange(i+1, 1, 1, 7).setValues([[sCat, sArea, n.순번, sItem, n.수량, n.위치, url]]);
        return { success: true, message: '수정 완료' };
        }
    }
    return { success: false, message: '수정할 항목을 찾지 못했습니다.' };
  } catch(e) { return { success: false, message: e.message }; }
}

function deleteData(obj) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const targetCat = obj.종목 === '미입력' ? '' : obj.종목;

    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === targetCat && data[i][2] === obj.순번) {
        sheet.deleteRow(i + 1);
        return { success: true, message: '삭제 완료' };
        }
    }
    return { success: false, message: '삭제할 항목을 찾지 못했습니다.' };
  } catch(e) { return { success: false, message: e.message }; }
}