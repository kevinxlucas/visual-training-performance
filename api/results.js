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
  'createdAtLocal',
  'visualPerformanceEvaluationQuestion',
  'visualPerformanceEvaluationScore'
];

const VISUAL_PERFORMANCE_QUESTION = 'De 0 a 10, como avalias a tua performance visual neste dia?';

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function requireEnv() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_SHEET_ID'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    const err = new Error(`Configuração incompleta no servidor: ${missing.join(', ')}`);
    err.statusCode = 503;
    throw err;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

async function getAccessToken() {
  requireEnv();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const err = new Error('Falha ao renovar o token Google OAuth no servidor.');
    err.statusCode = 502;
    throw err;
  }
  return data.access_token;
}

function sheetName() {
  return process.env.GOOGLE_SHEET_NAME || 'Resultados';
}

function escapeSheetName(name) {
  return String(name).replace(/'/g, "''");
}

async function sheetsFetch(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error?.message || 'Erro na API do Google Sheets.');
    err.statusCode = response.status >= 500 ? 502 : response.status;
    throw err;
  }
  return data;
}

async function ensureHeaderRow() {
  const range = encodeURIComponent(`'${escapeSheetName(sheetName())}'!A1:W1`);
  const current = await sheetsFetch(`/values/${range}`);
  const values = current.values || [];
  const activeHeaders = (values[0] || []).filter(Boolean);
  if (!values.length || values[0][0] !== 'attemptId' || activeHeaders.join('|') !== SHEET_HEADERS.join('|')) {
    await sheetsFetch(`/values/${range}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [SHEET_HEADERS] })
    });
  }
}

function recordFromRow(row) {
  const obj = {};
  SHEET_HEADERS.forEach((header, index) => {
    obj[header] = row[index] ?? '';
  });
  for (const key of ['sessionNumber', 'attemptNumber', 'levelReached', 'totalAttemptTimeMs', 'finalScore', 'hits', 'errors', 'averageResponseTimeMs', 'bestResponseTimeMs', 'worstResponseTimeMs', 'totalTrials', 'percentCorrect', 'personalVisualPerformanceRating', 'visualPerformanceEvaluationScore']) {
    if (obj[key] !== '') obj[key] = Number(obj[key]);
  }
  try {
    obj.settings = obj.settingsJson ? JSON.parse(obj.settingsJson) : null;
  } catch (_) {
    obj.settings = null;
  }
  obj.synced = true;
  return obj;
}

async function getRecords() {
  await ensureHeaderRow();
  const range = encodeURIComponent(`'${escapeSheetName(sheetName())}'!A2:W`);
  const data = await sheetsFetch(`/values/${range}?majorDimension=ROWS`);
  return (data.values || []).filter((row) => row[0]).map(recordFromRow);
}

function normalizeRecord(input) {
  if (!input || typeof input !== 'object') throw Object.assign(new Error('Registo inválido.'), { statusCode: 400 });
  if (!input.attemptId || typeof input.attemptId !== 'string') throw Object.assign(new Error('attemptId obrigatório.'), { statusCode: 400 });
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
    createdAtLocal: input.createdAtLocal || input.dateTime || new Date().toISOString(),
    visualPerformanceEvaluationQuestion: String(input.visualPerformanceEvaluationQuestion || VISUAL_PERFORMANCE_QUESTION),
    visualPerformanceEvaluationScore: input.visualPerformanceEvaluationScore == null
      ? (input.personalVisualPerformanceRating == null ? '' : Number(input.personalVisualPerformanceRating))
      : Number(input.visualPerformanceEvaluationScore)
  };
}

function rowFromRecord(record) {
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
    record.createdAtLocal,
    record.visualPerformanceEvaluationQuestion,
    record.visualPerformanceEvaluationScore
  ];
}

async function appendRecord(input) {
  await ensureHeaderRow();
  const record = normalizeRecord(input);
  const existing = await getRecords();
  if (existing.some((row) => row.attemptId === record.attemptId)) {
    return { status: 'duplicate', record: { ...record, synced: true } };
  }
  const range = encodeURIComponent(`'${escapeSheetName(sheetName())}'!A:W`);
  await sheetsFetch(`/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [rowFromRecord(record)] })
  });
  return { status: 'created', record: { ...record, synced: true } };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method === 'GET') {
      const records = await getRecords();
      send(res, 200, { records });
      return;
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const result = await appendRecord(body);
      send(res, result.status === 'duplicate' ? 200 : 201, result);
      return;
    }
    send(res, 405, { error: 'Método não permitido.' });
  } catch (error) {
    send(res, error.statusCode || 500, { error: error.message || 'Erro inesperado.' });
  }
};
