/*
 * Visual Training Performance — Google Apps Script backend
 *
 * Como usar:
 * 1) Criar um projeto em https://script.google.com/.
 * 2) Colar este ficheiro em Code.gs.
 * 3) Definir SHEET_ID com o ID da folha "Visual Training Performance Database".
 * 4) Deploy > New deployment > Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5) Copiar o Web app URL para config.js: window.VisualTrainingConfig = { apiUrl: '...' }.
 *
 * Não há client secret, refresh token ou password no frontend.
 */

const SHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'Resultados';

const SHEET_HEADERS = [
  'attemptId',
  'syncedAt',
  'dateTime',
  'sessionNumber',
  'attemptNumber',
  'levelReached',
  'totalAttemptTimeMs',
  'finalScore',
  'hits',
  'errors',
  'averageResponseTimeMs',
  'bestResponseTimeMs',
  'worstResponseTimeMs',
  'difficultySpeed',
  'settingsJson',
  'personalVisualPerformanceRating',
  'observations',
  'configSummary',
  'totalTrials',
  'percentCorrect',
  'createdAtLocal'
];

function doGet() {
  try {
    const sheet = getSheet_();
    ensureHeaderRow_(sheet);
    return json_({ records: getRecords_(sheet) });
  } catch (error) {
    return json_({ error: String(error && error.message ? error.message : error) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const payload = parsePayload_(e);
    const sheet = getSheet_();
    ensureHeaderRow_(sheet);
    const record = normalizeRecord_(payload);
    const existing = getRecords_(sheet);
    if (existing.some(function(row) { return row.attemptId === record.attemptId; })) {
      return json_({ status: 'duplicate', record: Object.assign({}, record, { synced: true }) });
    }
    sheet.appendRow(rowFromRecord_(record));
    return json_({ status: 'created', record: Object.assign({}, record, { synced: true }) });
  } catch (error) {
    return json_({ error: String(error && error.message ? error.message : error) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  if (!SHEET_ID || SHEET_ID === 'PASTE_GOOGLE_SHEET_ID_HERE') {
    throw new Error('Configura SHEET_ID no Google Apps Script.');
  }
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function ensureHeaderRow_(sheet) {
  const width = Math.max(SHEET_HEADERS.length, sheet.getLastColumn() || SHEET_HEADERS.length);
  let current = sheet.getRange(1, 1, 1, width).getValues()[0];
  const activeHeaders = current.filter(function(value) { return value !== ''; });
  if (current[0] !== 'attemptId' || activeHeaders.join('|') !== SHEET_HEADERS.join('|')) {
    sheet.getRange(1, 1, 1, Math.max(SHEET_HEADERS.length, sheet.getLastColumn() || SHEET_HEADERS.length)).clearContent();
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function getRecords_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getValues();
  return rows.filter(function(row) { return row[0]; }).map(recordFromRow_);
}

function parsePayload_(e) {
  const text = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  return JSON.parse(text);
}

function normalizeRecord_(input) {
  if (!input || typeof input !== 'object') throw new Error('Registo inválido.');
  if (!input.attemptId || typeof input.attemptId !== 'string') throw new Error('attemptId obrigatório.');
  return {
    attemptId: input.attemptId,
    dateTime: input.dateTime || new Date().toISOString(),
    sessionNumber: Number(input.sessionNumber || 0),
    attemptNumber: Number(input.attemptNumber || 0),
    levelReached: Number(input.levelReached || 0),
    totalAttemptTimeMs: Number(input.totalAttemptTimeMs || 0),
    finalScore: Number(input.finalScore || 0),
    hits: Number(input.hits || 0),
    errors: Number(input.errors || 0),
    averageResponseTimeMs: input.averageResponseTimeMs == null ? '' : Number(input.averageResponseTimeMs),
    bestResponseTimeMs: input.bestResponseTimeMs == null ? '' : Number(input.bestResponseTimeMs),
    worstResponseTimeMs: input.worstResponseTimeMs == null ? '' : Number(input.worstResponseTimeMs),
    difficultySpeed: input.difficultySpeed == null ? '' : String(input.difficultySpeed),
    settingsJson: JSON.stringify(input.settings || {}),
    personalVisualPerformanceRating: input.personalVisualPerformanceRating == null ? '' : Number(input.personalVisualPerformanceRating),
    observations: String(input.observations || '').slice(0, 1000),
    configSummary: String(input.configSummary || '').slice(0, 1000),
    totalTrials: Number(input.totalTrials || 0),
    percentCorrect: Number(input.percentCorrect || 0),
    createdAtLocal: input.createdAtLocal || input.dateTime || new Date().toISOString()
  };
}

function rowFromRecord_(record) {
  return [
    record.attemptId,
    new Date().toISOString(),
    record.dateTime,
    record.sessionNumber,
    record.attemptNumber,
    record.levelReached,
    record.totalAttemptTimeMs,
    record.finalScore,
    record.hits,
    record.errors,
    record.averageResponseTimeMs,
    record.bestResponseTimeMs,
    record.worstResponseTimeMs,
    record.difficultySpeed,
    record.settingsJson,
    record.personalVisualPerformanceRating,
    record.observations,
    record.configSummary,
    record.totalTrials,
    record.percentCorrect,
    record.createdAtLocal
  ];
}

function recordFromRow_(row) {
  const obj = {};
  SHEET_HEADERS.forEach(function(header, index) {
    obj[header] = row[index] == null ? '' : row[index];
  });
  ['sessionNumber', 'attemptNumber', 'levelReached', 'totalAttemptTimeMs', 'finalScore', 'hits', 'errors', 'averageResponseTimeMs', 'bestResponseTimeMs', 'worstResponseTimeMs', 'totalTrials', 'percentCorrect', 'personalVisualPerformanceRating'].forEach(function(key) {
    if (obj[key] !== '') obj[key] = Number(obj[key]);
  });
  try {
    obj.settings = obj.settingsJson ? JSON.parse(obj.settingsJson) : null;
  } catch (_) {
    obj.settings = null;
  }
  obj.synced = true;
  obj.pendingSync = false;
  return obj;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
