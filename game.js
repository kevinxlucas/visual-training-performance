// Visual Training Performance
// Código p5.js atualizado mantendo as mecânicas originais e acrescentando persistência, sincronização e análise.

let stimuli = ['1', '2', '3', '4'];
let trials = [];
let currentStimulus = '';
let stimulusX = 0, stimulusY = 0;
let stimulusShown = false;
let stimulusStartTime = 0;
let stimulusDuration = 3000;
let score = 0;
let total = 0;
let testFinished = false;
let feedbackStartTime = 0;
let showingFeedback = false;
let feedbackDuration = 200;
let started = false;
let oscCorrect, oscWrong, oscLevelUp, oscGameOver, oscExtraLife;
let leftTrials = 0, rightTrials = 0;
let leftCorrect = 0, rightCorrect = 0;
let stimulusShownSide = '';
let trialData = [];
let exportButton;
let textSizeStimulus = 64;
let shapeSize = 60;
let feedbackShape = null;
let feedbackColor = null;
let roundCount = 0;
let divisionLevel = 0;
let movementEnabled = false; // Alteração: estado inicial parado. A tecla M continua a alternar.
let moveToCenter = false;
let showShapes = true; // Alteração: iniciar com formas visíveis em vez de números.
let stimulusVX = 0;
let stimulusVY = 0;
let correctStreak = 0;
let level = 1;
let showLevelUp = false;
let levelUpTime = 0;
let consecutiveErrors = 0;
let timePaused = false;
let timeLimited = true;
let lives = 5;
let currentStyle = 'default';
let errorPositions = [];

let FIX_X = 0, FIX_Y = 0;
const NEAR_RADIUS = 140; // raio da zona "perto da mira"

const DB_NAME = 'visual-training-performance-db';
const STORE_NAME = 'attempts';
const LOCAL_API_URL = '/api/results';
const CONFIGURED_API_URL = window.VisualTrainingConfig && typeof window.VisualTrainingConfig.apiUrl === 'string'
  ? window.VisualTrainingConfig.apiUrl.trim()
  : '';
const IS_LOCAL_HOST = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
const API_URL = CONFIGURED_API_URL || (IS_LOCAL_HOST ? LOCAL_API_URL : '');
const SESSION_NUMBER_KEY = 'visualTrainingSessionNumber';
const VISUAL_PERFORMANCE_QUESTION = 'De 0 a 10, como avalias a tua performance visual neste dia?';
let dbPromise = null;
let historyRecords = [];
let currentSavedRecord = null;
let currentAttemptId = '';
let currentAttemptNumber = 0;
let sessionNumber = 1;
let attemptStartTime = 0;
let attemptStartTrialIndex = 0;
let attemptStartScore = 0;
let attemptStartTotal = 0;
let resultSaveStarted = false;
let ratingDialogReady = false;
let lastSyncMessage = 'Base de dados local pronta.';

function setup() {
  createCanvas(windowWidth, windowHeight);
  FIX_X = width / 2;
  FIX_Y = height / 2;

  textAlign(CENTER, CENTER);
  textFont('Georgia');

  oscCorrect = new p5.Oscillator('sine');    oscCorrect.freq(660);  oscCorrect.amp(0); oscCorrect.start();
  oscWrong = new p5.Oscillator('sine');      oscWrong.freq(220);    oscWrong.amp(0);   oscWrong.start();
  oscLevelUp = new p5.Oscillator('square');  oscLevelUp.freq(880);  oscLevelUp.amp(0); oscLevelUp.start();
  oscGameOver = new p5.Oscillator('triangle'); oscGameOver.freq(120); oscGameOver.amp(0); oscGameOver.start();
  oscExtraLife = new p5.Oscillator('square');  oscExtraLife.amp(0);  oscExtraLife.start();

  generateTrials();
  initPersistence();
  setupRatingDialog();
  registerServiceWorker();
  noCursor();
}

function draw() {
  if (!started) { drawStartScreen(); drawTopUi(); return; }
  if (testFinished) {
    showResults();
    maybeAskAndSaveResult();
    return;
  }

  switch (currentStyle) {
    case 'retro': background(0); break;
    case 'minimal': background(255); break;
    default:
      colorMode(HSB, 360, 100, 100);
      let hue = (level * 60) % 360;
      background(hue, 50, 95);
      colorMode(RGB, 255);
  }

  drawFixationPoint();
  drawDivisions();
  drawHearts();

  if (showLevelUp && millis() - levelUpTime < 1000) {
    fill(50, 200, 180); textSize(80); text(`Nível ${level}`, width / 2, height / 2);
    drawStatusDisplay(); drawTopUi(); return;
  } else {
    showLevelUp = false;
  }

  if (timePaused) {
    fill(50); textSize(32); text('Pausado', width / 2, 50);
    drawStatusDisplay(); drawTopUi(); return;
  }

  if (showingFeedback) {
    drawFeedbackShape();
    if (millis() - feedbackStartTime > feedbackDuration) {
      showingFeedback = false;
      nextStimulus();
    }
    drawStatusDisplay(); drawTopUi(); return;
  }

  if (stimulusShown) {
    if (timeLimited && millis() - stimulusStartTime > stimulusDuration) {
      total++; recordResponse(false); giveFeedback(false);
    } else {
      if (movementEnabled) {
        if (moveToCenter) {
          let dx = FIX_X - stimulusX;
          let dy = FIX_Y - stimulusY;
          let dist = sqrt(dx * dx + dy * dy);
          let speed = 1 + level * 0.1;
          if (dist > 1) {
            stimulusVX = (dx / dist) * speed;
            stimulusVY = (dy / dist) * speed;
          }
        }
        stimulusX += stimulusVX;
        stimulusY += stimulusVY;
        if (!moveToCenter) {
          if (stimulusX < 50 || stimulusX > width - 50) stimulusVX *= -1;
          if (stimulusY < 50 || stimulusY > height - 50) stimulusVY *= -1;
        }
      }
      let sizeReduction = (level - 1) * 5;
      let currentTextSize = max(20, textSizeStimulus - sizeReduction);
      let currentShapeSize = max(20, shapeSize - sizeReduction);
      drawStimulus(currentStimulus, stimulusX, stimulusY, currentTextSize, currentShapeSize);
    }
  }

  drawStatusDisplay();
  drawTopUi();
}

function drawStimulus(stim, x, y, txtSize, shpSize) {
  noStroke();
  if (currentStyle === 'retro') { fill('#0ff'); stroke('#f0f'); strokeWeight(2); }
  else if (currentStyle === 'minimal') { fill(30); noStroke(); }
  else fill('#333');

  if (showShapes) {
    let s = shpSize;
    if (stim === '1') { rectMode(CENTER); rect(x, y, s, s); }
    else if (stim === '2') ellipse(x, y, s, s);
    else if (stim === '3') triangle(x, y - s / 2, x - s / 2, y + s / 2, x + s / 2, y + s / 2);
    else if (stim === '4') drawPentagon(x, y, s / 2);
  } else {
    textSize(txtSize);
    textFont(currentStyle === 'retro' ? 'Courier New' : 'Georgia');
    text(stim, x, y);
  }
}

function drawPentagon(x, y, radius) {
  beginShape();
  for (let i = 0; i < 5; i++) {
    let angle = TWO_PI * i / 5 - PI / 2;
    vertex(x + cos(angle) * radius, y + sin(angle) * radius);
  }
  endShape(CLOSE);
}

function keyPressed() {
  if (!started) return;

  if (testFinished && key === ' ') {
    if (exportButton) exportButton.remove();
    restartTest();
  }

  const pressed = String(key).toLowerCase();
  if (pressed === 't') timeLimited = !timeLimited;
  if (key === '+') { textSizeStimulus += 5; shapeSize += 5; }
  if (key === '-') { textSizeStimulus = max(10, textSizeStimulus - 5); shapeSize = max(10, shapeSize - 5); }
  if (pressed === 'f') showShapes = !showShapes;
  if (pressed === 'm') movementEnabled = !movementEnabled;
  if (pressed === 'q') divisionLevel = (divisionLevel + 1) % 4;
  if (pressed === 'd') {
    if (currentStyle === 'default') currentStyle = 'retro';
    else if (currentStyle === 'retro') currentStyle = 'minimal';
    else currentStyle = 'default';
  }
  if (pressed === 'c') moveToCenter = !moveToCenter;

  if (!stimulusShown || testFinished) return;

  if (keyCode === LEFT_ARROW)  stimulusX -= 10;
  if (keyCode === RIGHT_ARROW) stimulusX += 10;
  if (keyCode === UP_ARROW)    stimulusY -= 10;
  if (keyCode === DOWN_ARROW)  stimulusY += 10;

  if (stimuli.includes(key)) {
    let correct = key === currentStimulus;
    if (correct) score++;
    total++;
    recordResponse(correct);
    giveFeedback(correct);
  }
}

function giveFeedback(correct) {
  stimulusShown = false;
  feedbackStartTime = millis();
  showingFeedback = true;

  feedbackColor = correct ? color(100, 220, 180) : color(240, 80, 80);
  feedbackShape = random(['circle', 'square', 'triangle']);

  if (correct) {
    consecutiveErrors = 0;
    if (stimulusShownSide === 'left') {
      correctStreak++;
      if (correctStreak % 4 === 0) { lives++; playExtraLifeSound(); }
      if (correctStreak % 5 === 0) {
        level++; showLevelUp = true; levelUpTime = millis();
        oscLevelUp.amp(0.3, 0.05); oscLevelUp.amp(0, 0.3);
      }
    }
    oscCorrect.amp(0.2, 0.05); oscCorrect.amp(0, 0.2);
  } else {
    if (stimulusShownSide === 'left') correctStreak = 0;
    consecutiveErrors++; lives--;
    if (lives <= 0) { testFinished = true; playGameOverSound(); }
    oscWrong.amp(0.15, 0.05); oscWrong.amp(0, 0.2);
  }
}

function playGameOverSound() {
  oscGameOver.freq(140); oscGameOver.amp(0.4, 0.1);
  oscGameOver.freq(90, 0.3);  oscGameOver.amp(0, 0.8);
}

function playExtraLifeSound() {
  const notes = [
    { freq: 1319, duration: 100 }, { freq: 1568, duration: 100 },
    { freq: 1760, duration: 100 }, { freq: 2637, duration: 150 }
  ];
  notes.forEach((note, index) => {
    setTimeout(() => {
      oscExtraLife.freq(note.freq);
      oscExtraLife.amp(0.3, 0.05);
      oscExtraLife.amp(0, 0.2);
    }, index * 100);
  });
}

function drawFeedbackShape() {
  fill(feedbackColor); noStroke();
  let x = 50, y = 50, s = 30;
  if (feedbackShape === 'circle') ellipse(x, y, s, s);
  else if (feedbackShape === 'square') rect(x - s / 2, y - s / 2, s, s, 5);
  else if (feedbackShape === 'triangle') triangle(x, y - s / 2, x - s / 2, y + s / 2, x + s / 2, y + s / 2);
}

function recordResponse(correct) {
  let responseTime = millis() - stimulusStartTime;
  let timestamp = new Date().toISOString();
  trialData.push({ stimulus: currentStimulus, side: stimulusShownSide, correct, responseTime, timestamp, x: stimulusX, y: stimulusY, level });
  if (!correct) errorPositions.push({ stim: currentStimulus, x: stimulusX, y: stimulusY });

  if (stimulusShownSide === 'left') {
    if (correct) leftCorrect++;
  } else {
    if (correct) rightCorrect++;
  }
}

function generateTrials() {
  trials = [];
  for (let i = 0; i < 2000; i++) trials.push('tick');
}

function nextStimulus() {
  if (trials.length === 0) { testFinished = true; return; }
  trials.pop();

  let side = 'left';
  stimulusShownSide = side;
  leftTrials++;

  const margin = 20;
  let placed = false;
  for (let i = 0; i < 50 && !placed; i++) {
    let theta = random(PI, 1.5 * PI);
    let r = random(20, NEAR_RADIUS);
    let x = FIX_X + r * cos(theta);
    let y = FIX_Y + r * sin(theta);

    if (x > margin && y > margin && x < FIX_X - margin && y < FIX_Y - margin) {
      stimulusX = x;
      stimulusY = y;
      placed = true;
    }
  }

  if (!placed) {
    stimulusX = constrain(FIX_X - NEAR_RADIUS, margin, width - margin);
    stimulusY = constrain(FIX_Y - NEAR_RADIUS, margin, height - margin);
  }

  stimulusVX = random(-2, 2);
  stimulusVY = random(-2, 2);
  currentStimulus = random(stimuli);
  stimulusShown = true;
  stimulusStartTime = millis();
}

function beginAttemptCounters() {
  currentAttemptNumber++;
  currentAttemptId = `vtp-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
  attemptStartTime = millis();
  attemptStartTrialIndex = trialData.length;
  attemptStartScore = score;
  attemptStartTotal = total;
  currentSavedRecord = null;
  resultSaveStarted = false;
  document.getElementById('resultsPanel')?.classList.add('hidden');
  updateQuickStats();
}

function startTest() {
  started = true;
  testFinished = false;
  roundCount = 1;
  level = 1;
  correctStreak = 0;
  consecutiveErrors = 0;
  lives = 5;
  errorPositions = [];
  showShapes = true;
  movementEnabled = false;
  generateTrials();
  beginAttemptCounters();
  nextStimulus();
}

function restartTest() {
  testFinished = false;
  roundCount++;
  level = 1;
  correctStreak = 0;
  consecutiveErrors = 0;
  lives = 5;
  errorPositions = [];
  generateTrials();
  beginAttemptCounters();
  nextStimulus();
}

function drawFixationPoint() {
  if (currentStyle === 'minimal') fill(100);
  else if (currentStyle === 'retro') fill('#f0f');
  else fill(70);
  ellipse(FIX_X, FIX_Y, 10, 10);
}

function drawDivisions() {
  stroke(180); strokeWeight(1);
  let divisions = [0, 2, 4, 8][divisionLevel];

  line(FIX_X, 0, FIX_X, height);
  line(0, FIX_Y, width, FIX_Y);

  if (divisions === 0) return;

  let stepX = width / divisions;
  let stepY = height / divisions;
  for (let i = 1; i < divisions; i++) {
    line(FIX_X + i * stepX, 0, FIX_X + i * stepX, height);
    line(FIX_X - i * stepX, 0, FIX_X - i * stepX, height);
    line(0, FIX_Y + i * stepY, width, FIX_Y + i * stepY);
    line(0, FIX_Y - i * stepY, width, FIX_Y - i * stepY);
  }
}

function drawStartScreen() {
  background('#1c1c1c');
  noStroke();
  fill('#ffffff');
  textSize(36);
  text('Clique para iniciar em ecrã completo', width / 2, height / 2 - 92);
  textSize(18);
  text('Estado inicial: formas geométricas visíveis e paradas. Prima M para ativar o movimento.', width / 2, height / 2 - 50);

  const y = height / 2 + 36;
  const s = 54;
  fill('#14b8a6'); rectMode(CENTER); rect(width / 2 - 132, y, s, s, 10);
  fill('#60a5fa'); ellipse(width / 2 - 44, y, s, s);
  fill('#f59e0b'); triangle(width / 2 + 44, y - s / 2, width / 2 + 44 - s / 2, y + s / 2, width / 2 + 44 + s / 2, y + s / 2);
  fill('#f472b6'); drawPentagon(width / 2 + 132, y, s / 2);
}

function drawStatusDisplay() {
  push();
  textSize(14); fill(80); noStroke(); textAlign(RIGHT, BOTTOM);
  const fonteAtual = max(20, textSizeStimulus - (level - 1) * 5);
  text(`Fonte: ${fonteAtual} | Movimento: ${movementEnabled ? 'Sim' : 'Não'} | Centro: ${moveToCenter ? 'Sim' : 'Não'} | Formas: ${showShapes ? 'Sim' : 'Não'} | Ronda: ${roundCount}`, width - 10, height - 10);
  textAlign(RIGHT, TOP); fill(30); textSize(18);
  text(`Nível: ${level} | ${timeLimited ? 'Com tempo' : 'Sem tempo'} | Estilo: ${currentStyle}`, width - 20, 52);

  textAlign(CENTER, BOTTOM);
  fill(20);
  const sx = stimulusShown ? int(stimulusX) : '-';
  const sy = stimulusShown ? int(stimulusY) : '-';
  text(`Evento: (${sx}, ${sy})  |  Mira: (${int(FIX_X)}, ${int(FIX_Y)})`, width / 2, height - 30);
  pop();
}

function drawTopUi() {
  updateQuickStats();
}

function drawHearts() {
  for (let i = 0; i < lives; i++) drawHeart(20 + i * 35, 20, 20);
}

function drawHeart(x, y, size) {
  // p5 v2 pode lançar erro com beginShape()+bezierVertex() em alguns browsers.
  // Mantém a mesma indicação de vidas, mas desenha o coração como texto estável.
  push();
  noStroke();
  fill('#e74c3c');
  textAlign(CENTER, CENTER);
  textSize(size * 1.35);
  text('♥', x, y + size * 0.15);
  pop();
}

function showResults() {
  background('#eaf2f2'); fill('#333'); textSize(28);
  let totalCorrect = trialData.filter(d => d.correct).length;
  let percent = total > 0 ? int((totalCorrect / total) * 100) : 0;
  let leftPercent = leftTrials > 0 ? int((leftCorrect / leftTrials) * 100) : 0;
  let rightPercent = rightTrials > 0 ? int((rightCorrect / rightTrials) * 100) : 0;

  text(`Acertos totais: ${totalCorrect}/${total} (${percent}%)`, width / 2, 60);
  textSize(20);
  text(`Lado Esquerdo: ${leftCorrect}/${leftTrials} (${leftPercent}%)`, width / 2, 100);
  text(`Lado Direito: ${rightCorrect}/${rightTrials} (${rightPercent}%)`, width / 2, 130);
  text('Pressione [ESPAÇO] para nova ronda', width / 2, 180);

  errorPositions.forEach((e, i) => {
    push();
    fill(color(`hsl(${(i * 40) % 360} 100% 40%)`));
    textSize(24);
    text(e.stim, e.x + (i % 5), e.y + (i % 5));
    pop();
  });

  drawDivisions();
  drawStatusDisplay();
  drawTopUi();
}

function mousePressed() {
  if (!started) {
    fullscreen(true);
    resizeCanvas(windowWidth, windowHeight);
    FIX_X = width / 2;
    FIX_Y = height / 2;
    userStartAudio();
    startTest();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  FIX_X = width / 2;
  FIX_Y = height / 2;
}

function initPersistence() {
  const previousSession = Number(localStorage.getItem(SESSION_NUMBER_KEY) || '0');
  sessionNumber = previousSession + 1;
  localStorage.setItem(SESSION_NUMBER_KEY, String(sessionNumber));
  updateQuickStats();
  openDb().then(loadLocalRecords).then(() => syncPending()).then(() => fetchCloudRecords()).catch(() => {
    setSyncStatus('Base local ativa. Google Sheets será sincronizado quando disponível.');
  });
  window.addEventListener('online', () => syncPending());
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'attemptId' });
        store.createIndex('dateTime', 'dateTime', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function dbPut(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function dbAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function loadLocalRecords() {
  historyRecords = (await dbAll()).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  renderResultsPanel();
  return historyRecords;
}

async function saveAttemptLocally(record) {
  const existing = historyRecords.find((item) => item.attemptId === record.attemptId);
  if (existing) Object.assign(existing, record);
  else historyRecords.push(record);
  historyRecords.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  await dbPut(record);
  renderResultsPanel();
}

async function fetchCloudRecords() {
  if (!API_URL) {
    setSyncStatus('Google Sheets ainda não configurado nesta publicação. Dados guardados localmente.');
    return;
  }
  try {
    const response = await fetch(API_URL, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Google Sheets indisponível');
    const data = await response.json();
    const cloudRecords = Array.isArray(data.records) ? data.records : [];
    for (const cloudRecord of cloudRecords) {
      const normalized = { ...cloudRecord, synced: true, pendingSync: false };
      await saveAttemptLocally(normalized);
    }
    const pending = historyRecords.filter((record) => record.pendingSync || !record.synced).length;
    setSyncStatus(pending ? `${pending} resultado(s) pendente(s) para Google Sheets.` : 'Resultados sincronizados com Google Sheets.');
  } catch (error) {
    setSyncStatus('Sem internet ou Google Sheets indisponível. Os dados ficam guardados localmente.');
  }
}

async function syncPending() {
  await loadLocalRecords();
  const pending = historyRecords.filter((record) => record.pendingSync || !record.synced);
  if (!pending.length) {
    setSyncStatus(API_URL ? 'Resultado sincronizado com Google Sheets.' : 'Base local pronta. Google Sheets ainda não configurado.');
    return;
  }
  if (!API_URL) {
    setSyncStatus('Resultado guardado localmente. Google Sheets ainda não configurado.');
    return;
  }
  if (!navigator.onLine) {
    setSyncStatus('Sem internet. Será sincronizado mais tarde.');
    return;
  }
  let syncedCount = 0;
  for (const record of pending) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': CONFIGURED_API_URL ? 'text/plain;charset=utf-8' : 'application/json', Accept: 'application/json' },
        // A autoavaliação faz parte do registo principal e é enviada para Google Sheets.
        body: JSON.stringify(recordForGoogleSheets(record))
      });
      if (!response.ok) throw new Error('Falha na sincronização');
      record.synced = true;
      record.pendingSync = false;
      record.syncedAt = new Date().toISOString();
      await saveAttemptLocally(record);
      syncedCount++;
    } catch (error) {
      record.pendingSync = true;
      record.synced = false;
      await saveAttemptLocally(record);
      setSyncStatus('Sem internet. Será sincronizado mais tarde.');
      break;
    }
  }
  if (syncedCount) setSyncStatus('Resultado sincronizado com Google Sheets.');
}

function setupRatingDialog() {
  const form = document.getElementById('ratingForm');
  const dialog = document.getElementById('ratingDialog');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const ratingInput = document.getElementById('performanceRating');
    const notesInput = document.getElementById('performanceNotes');
    const error = document.getElementById('ratingError');
    const rating = Number(ratingInput.value);
    if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
      error.textContent = 'Introduz obrigatoriamente um número inteiro entre 0 e 10.';
      return;
    }
    error.textContent = '';
    dialog.close();
    await finalizeAndStoreAttempt(rating, notesInput.value.trim());
    ratingInput.value = '';
    notesInput.value = '';
  });
  ratingDialogReady = true;
}

function maybeAskAndSaveResult() {
  if (resultSaveStarted || currentSavedRecord || !ratingDialogReady) return;
  resultSaveStarted = true;
  const dialog = document.getElementById('ratingDialog');
  if (dialog && !dialog.open) {
    document.getElementById('ratingError').textContent = '';
    dialog.showModal();
  }
}

async function finalizeAndStoreAttempt(rating, observations) {
  const record = buildAttemptRecord(rating, observations);
  currentSavedRecord = record;
  await saveAttemptLocally(record);
  setSyncStatus('Resultado guardado localmente. A sincronizar com Google Sheets…');
  await syncPending();
  await fetchCloudRecords();
  renderResultsPanel();
}

function buildAttemptRecord(rating, observations) {
  const attemptTrials = trialData.slice(attemptStartTrialIndex);
  const hits = attemptTrials.filter((item) => item.correct).length;
  const errors = attemptTrials.length - hits;
  const responseTimes = attemptTrials.map((item) => item.responseTime).filter((value) => Number.isFinite(value));
  const avg = responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null;
  const best = responseTimes.length ? Math.min(...responseTimes) : null;
  const worst = responseTimes.length ? Math.max(...responseTimes) : null;
  const attemptTotal = total - attemptStartTotal;
  const attemptScore = score - attemptStartScore;
  const percentCorrect = attemptTotal > 0 ? Math.round((attemptScore / attemptTotal) * 100) : 0;
  const settings = currentSettings();
  return {
    attemptId: currentAttemptId,
    dateTime: new Date().toISOString(),
    sessionNumber,
    attemptNumber: currentAttemptNumber,
    levelReached: level,
    totalAttemptTimeMs: Math.max(0, Math.round(millis() - attemptStartTime)),
    finalScore: attemptScore,
    hits,
    errors,
    averageResponseTimeMs: avg,
    bestResponseTimeMs: best,
    worstResponseTimeMs: worst,
    difficultySpeed: settings.difficultySpeed,
    settings,
    // Mantém o campo histórico e acrescenta duas colunas finais explícitas para a folha.
    personalVisualPerformanceRating: rating,
    visualPerformanceEvaluationQuestion: VISUAL_PERFORMANCE_QUESTION,
    visualPerformanceEvaluationScore: rating,
    observations,
    configSummary: summarizeSettings(settings),
    totalTrials: attemptTotal,
    percentCorrect,
    createdAtLocal: new Date().toISOString(),
    synced: false,
    pendingSync: true
  };
}

function currentSettings() {
  const sizeReduction = (level - 1) * 5;
  return {
    showShapes,
    movementEnabled,
    moveToCenter,
    timeLimited,
    stimulusDuration,
    textSizeStimulus: max(20, textSizeStimulus - sizeReduction),
    shapeSize: max(20, shapeSize - sizeReduction),
    divisionLevel,
    currentStyle,
    lives,
    difficultySpeed: movementEnabled ? (moveToCenter ? `centro ${Number(1 + level * 0.1).toFixed(1)}` : `vetor ${Number(stimulusVX).toFixed(2)},${Number(stimulusVY).toFixed(2)}`) : 'parado'
  };
}

function summarizeSettings(settings) {
  return `Formas: ${settings.showShapes ? 'sim' : 'não'}; Movimento: ${settings.movementEnabled ? 'sim' : 'não'}; Centro: ${settings.moveToCenter ? 'sim' : 'não'}; Tempo: ${settings.timeLimited ? 'com limite' : 'sem limite'}; Estilo: ${settings.currentStyle}; Divisões: ${settings.divisionLevel}`;
}

function recordForGoogleSheets(record) {
  return record;
}

function renderResultsPanel() {
  const panel = document.getElementById('resultsPanel');
  if (!panel) return;
  if (historyRecords.length || currentSavedRecord) panel.classList.remove('hidden');
  const sorted = [...historyRecords].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  const currentCandidate = currentSavedRecord ? sorted.find((record) => record.attemptId === currentSavedRecord.attemptId) : null;
  const latest = currentCandidate || currentSavedRecord || sorted[sorted.length - 1];
  const current = document.getElementById('currentResult');
  if (current) current.innerHTML = latest ? [
    metric('Nível alcançado', latest.levelReached),
    metric('Pontuação', latest.finalScore),
    metric('Acertos / erros', `${latest.hits}/${latest.errors}`),
    metric('Avaliação pessoal', `${latest.personalVisualPerformanceRating}/10`),
    metric('Sincronização', latest.synced ? 'Resultado sincronizado com Google Sheets' : 'Resultado guardado localmente')
  ].join('') : 'Ainda sem resultados guardados.';

  const summary = document.getElementById('summaryStats');
  if (summary) {
    const totalAttempts = sorted.length;
    const avgRating = totalAttempts ? average(sorted.map((r) => Number(r.personalVisualPerformanceRating))).toFixed(1) : '—';
    const avgLevel = totalAttempts ? average(sorted.map((r) => Number(r.levelReached))).toFixed(1) : '—';
    const bestLevel = totalAttempts ? Math.max(...sorted.map((r) => Number(r.levelReached || 0))) : '—';
    const trend = recentTrend(sorted);
    const pending = sorted.filter((r) => r.pendingSync || !r.synced).length;
    summary.innerHTML = [
      metric('Tentativas guardadas', totalAttempts),
      metric('Média geral nível', avgLevel),
      metric('Média avaliação', `${avgRating}/10`),
      metric('Melhor nível alcançado', bestLevel),
      metric('Evolução recente', trend),
      metric('Estado Sheets', pending ? `${pending} pendente(s)` : 'Sincronizado')
    ].join('');
  }

  const recent = document.getElementById('recentAttempts');
  if (recent) {
    recent.innerHTML = sorted.slice(-5).reverse().map((r) => `<li>${formatDate(r.dateTime)} — nível ${r.levelReached}, avaliação ${r.personalVisualPerformanceRating}/10, ${r.synced ? 'Sheets OK' : 'pendente'}</li>`).join('');
  }
  drawEvolutionChart(sorted);
  updateQuickStats();
}

function metric(label, value) {
  return `<div class="metric-line"><strong>${label}:</strong> ${value}</div>`;
}

function average(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function recentTrend(records) {
  if (records.length < 2) return 'Ainda sem histórico suficiente';
  const recent = records.slice(-5);
  const first = Number(recent[0].levelReached || 0) + Number(recent[0].personalVisualPerformanceRating || 0);
  const last = Number(recent[recent.length - 1].levelReached || 0) + Number(recent[recent.length - 1].personalVisualPerformanceRating || 0);
  if (last > first) return 'a melhorar';
  if (last < first) return 'a piorar';
  return 'estável';
}

function drawEvolutionChart(records) {
  const canvas = document.getElementById('evolutionChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const widthPx = canvas.width;
  const heightPx = canvas.height;
  ctx.clearRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  const pad = 36;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, heightPx - pad);
  ctx.lineTo(widthPx - pad, heightPx - pad);
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.font = '12px sans-serif';
  ctx.fillText('Nível', 8, 18);
  ctx.fillText('Avaliação 0-10', widthPx - 120, 18);

  const data = records.slice(-12);
  if (!data.length) {
    ctx.fillText('Sem dados suficientes para o gráfico.', pad + 20, heightPx / 2);
    return;
  }
  const maxLevel = Math.max(10, ...data.map((r) => Number(r.levelReached || 0)));
  drawLine(ctx, data, (r) => Number(r.levelReached || 0), maxLevel, '#2563eb', pad, widthPx, heightPx);
  drawLine(ctx, data, (r) => Number(r.personalVisualPerformanceRating || 0), 10, '#14b8a6', pad, widthPx, heightPx);
  ctx.fillStyle = '#2563eb'; ctx.fillText('● nível alcançado', pad + 8, pad - 12);
  ctx.fillStyle = '#14b8a6'; ctx.fillText('● avaliação pessoal', pad + 150, pad - 12);
}

function drawLine(ctx, data, accessor, maxValue, colorValue, pad, widthPx, heightPx) {
  const plotW = widthPx - pad * 2;
  const plotH = heightPx - pad * 2;
  ctx.strokeStyle = colorValue;
  ctx.fillStyle = colorValue;
  ctx.lineWidth = 3;
  ctx.beginPath();
  data.forEach((record, index) => {
    const x = pad + (data.length === 1 ? plotW / 2 : (plotW * index) / (data.length - 1));
    const y = heightPx - pad - (Math.min(maxValue, accessor(record)) / maxValue) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  data.forEach((record, index) => {
    const x = pad + (data.length === 1 ? plotW / 2 : (plotW * index) / (data.length - 1));
    const y = heightPx - pad - (Math.min(maxValue, accessor(record)) / maxValue) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function formatDate(dateISO) {
  try {
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateISO));
  } catch (_) {
    return dateISO;
  }
}

function setSyncStatus(message) {
  lastSyncMessage = message;
  const el = document.getElementById('syncStatus');
  if (el) el.textContent = message;
}

function updateQuickStats() {
  const el = document.getElementById('quickStats');
  if (el) el.textContent = `Sessão ${sessionNumber} | Tentativa ${currentAttemptNumber || '—'} | ${historyRecords.length} registo(s)`;
  const status = document.getElementById('syncStatus');
  if (status && status.textContent !== lastSyncMessage) status.textContent = lastSyncMessage;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

// Pequeno gancho para testes manuais no browser sem alterar a jogabilidade.
window.VisualTrainingApp = {
  getState: () => ({ started, testFinished, showShapes, movementEnabled, level, score, total, sessionNumber, currentAttemptNumber, historyCount: historyRecords.length }),
  forceFinish: () => { testFinished = true; },
  syncPending,
  loadLocalRecords
};
