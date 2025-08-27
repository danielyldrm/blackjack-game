// Güncellenmiş Blackjack Oyunu
// Türkçe butonlar, surrender (teslim) ile Yeni Tur, Yeni Oyun reset, Web Audio sesleri

const SUITS = ['♠','♥','♦','♣'];
const RANKS = [
  {r:'A', v:11},
  {r:'K', v:10},
  {r:'Q', v:10},
  {r:'J', v:10},
  {r:'10',v:10},
  {r:'9', v:9},
  {r:'8', v:8},
  {r:'7', v:7},
  {r:'6', v:6},
  {r:'5', v:5},
  {r:'4', v:4},
  {r:'3', v:3},
  {r:'2', v:2}
];

let deck = [];
let playerHand = [];
let dealerHand = [];
let balance = 1000;
let currentBet = 50;
let gameOver = false;
let playerStood = false;
let handActive = false;

// İstatistikler
let stats = {
  games:0,
  wins:0,
  losses:0,
  pushes:0
};

// Ses kontrol
let soundEnabled = true;
let audioCtx = null;

// DOM referansları
const dealerCardsEl = document.getElementById('dealerCards');
const playerCardsEl = document.getElementById('playerCards');
const dealerValueEl = document.getElementById('dealerValue');
const playerValueEl = document.getElementById('playerValue');
const messageEl = document.getElementById('message');
const balanceEl = document.getElementById('balance');
const betInput = document.getElementById('betInput');

const dealBtn = document.getElementById('dealBtn');
const hitBtn = document.getElementById('hitBtn');
const standBtn = document.getElementById('standBtn');
const doubleBtn = document.getElementById('doubleBtn');
const newRoundBtn = document.getElementById('newRoundBtn');
const newGameBtn = document.getElementById('newGameBtn');
const soundToggle = document.getElementById('soundToggle');

const gamesPlayedEl = document.getElementById('gamesPlayed');
const winsEl = document.getElementById('wins');
const lossesEl = document.getElementById('losses');
const pushesEl = document.getElementById('pushes');
const winRateEl = document.getElementById('winRate');

// Başlat
updateBalance();
attachBetButtons();
renderStats();
attachEvents();

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
function playTone({freq=440, duration=0.12, type='square', vol=0.2, sweepTo=null}) {
  if (!soundEnabled) return;
  initAudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (sweepTo) {
    osc.frequency.linearRampToValueAtTime(sweepTo, audioCtx.currentTime + duration);
  }
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

const soundMap = {
  draw: () => playTone({freq: 520, duration:0.09, type:'triangle', sweepTo:480}),
  win:  () => { playTone({freq:700,duration:0.09,type:'sine'}); setTimeout(()=>playTone({freq:880,duration:0.12,type:'sine'}),90); },
  lose: () => { playTone({freq:320,duration:0.18,type:'sawtooth', sweepTo:180}); },
  push: () => { playTone({freq:500,duration:0.1,type:'square'}); setTimeout(()=>playTone({freq:500,duration:0.1,type:'square'}),110); },
  blackjack: () => { playTone({freq:760,duration:0.12,type:'sine'}); setTimeout(()=>playTone({freq:910,duration:0.18,type:'sine'}),110); }
};

function playSound(name) {
  if (soundMap[name]) soundMap[name]();
}

function createDeck() {
  const d = [];
  for (let s of SUITS) {
    for (let r of RANKS) {
      d.push({
        suit:s,
        rank:r.r,
        value:r.v,
        id:`${r.r}${s}-${Math.random().toString(36).slice(2,9)}`
      });
    }
  }
  return shuffle(d);
}

function shuffle(array) {
  for (let i = array.length -1; i >0; i--) {
    const j = Math.floor(Math.random()* (i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function startHand() {
  if (handActive) {
    showMessage('El zaten başladı. Kart Çek ya da Kal.', 'warn');
    return;
  }
  const desiredBet = parseInt(betInput.value,10);
  if (isNaN(desiredBet) || desiredBet < 10) {
    showMessage('Min bahis 10 olmalı.', 'warn');
    return;
  }
  if (desiredBet > 500) {
    showMessage('Max bahis 500 (ayarlanabilir).', 'warn');
    return;
  }
  if (desiredBet > balance) {
    showMessage('Yeterli bakiye yok.', 'warn');
    return;
  }

  currentBet = desiredBet;
  balance -= currentBet;
  updateBalance();

  deck = createDeck();
  playerHand = [];
  dealerHand = [];
  gameOver = false;
  playerStood = false;
  handActive = true;
  clearHands();

  initialDeal();

  renderHands(true);
  updateHandValues(true);

  enableActionButtons(true);
  newRoundBtn.disabled = false; // artık el içindeyken de aktif (teslim için)
  dealBtn.disabled = true;

  if (getBestValue(playerHand) === 21) {
    // Player blackjack
    endRound(); // dealer açılır
  } else {
    showMessage('Hamleni seç: Kart Çek / Kal / Çiftle', '');
  }
}

function initialDeal() {
  playerHand.push(drawCard());
  dealerHand.push(drawCard());
  playerHand.push(drawCard());
  dealerHand.push(drawCard());
}

function drawCard() {
  if (deck.length === 0) deck = createDeck();
  const c = deck.shift();
  playSound('draw');
  return c;
}

function renderHands(hideDealerSecond = false) {
  dealerCardsEl.innerHTML = '';
  playerCardsEl.innerHTML = '';

  dealerHand.forEach((card, idx) => {
    const hidden = (idx === 1 && hideDealerSecond && !gameOver && !playerStood);
    dealerCardsEl.appendChild(createCardElement(card, hidden));
  });

  playerHand.forEach(card => {
    playerCardsEl.appendChild(createCardElement(card, false));
  });
}

function createCardElement(card, hidden=false) {
  const el = document.createElement('div');
  el.className = 'card';
  if (hidden) {
    el.classList.add('back');
    return el;
  }
  const isRed = card.suit === '♥' || card.suit === '♦';
  if (isRed) el.classList.add('red');

  el.innerHTML = `
    <div class="rank">${card.rank}</div>
    <div class="suit">${card.suit}</div>
    <div class="center">${card.suit}</div>
  `;
  return el;
}

function updateHandValues(hideDealerSecond = false) {
  const playerVal = getBestValue(playerHand);
  const dealerVal = hideDealerSecond ? getCardValue(dealerHand[0]) : getBestValue(dealerHand);
  playerValueEl.textContent = playerVal;
  dealerValueEl.textContent = hideDealerSecond ? getCardValue(dealerHand[0]) + ' +' : dealerVal;

  if (!hideDealerSecond) {
    if (playerVal > 21) {
      showMessage('Bust! El yandı.', 'lose');
      endRound(true);
    }
  }
}

function getCardValue(card) { return card.value; }

function getBestValue(hand) {
  let total = 0;
  let aces = 0;
  hand.forEach(c => {
    total += c.value;
    if (c.rank === 'A') aces++;
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function hit() {
  if (gameOver || !handActive) return;
  playerHand.push(drawCard());
  renderHands(true);
  updateHandValues(true);

  const val = getBestValue(playerHand);
  if (val > 21) {
    showMessage('Bust! El yandı.', 'lose');
    endRound(true);
  } else if (val === 21) {
    stand(); // otomatik kal
  }
}

function stand() {
  if (gameOver || !handActive) return;
  playerStood = true;
  dealerPlay();
}

function doubleDown() {
  if (gameOver || !handActive) return;
  if (playerHand.length !== 2) {
    showMessage('Çiftle sadece ilk iki kartta yapılabilir.', 'warn');
    return;
  }
  if (currentBet > balance) {
    showMessage('Çiftle için bakiye yetersiz.', 'warn');
    return;
  }
  balance -= currentBet;
  currentBet *= 2;
  updateBalance();
  hit();
  if (!gameOver) {
    stand();
  }
}

function dealerPlay() {
  renderHands(false);
  updateHandValues(false);

  let dealerVal = getBestValue(dealerHand);
  while (dealerVal < 17 || (dealerVal === 17 && isSoft17(dealerHand))) {
    dealerHand.push(drawCard());
    renderHands(false);
    dealerVal = getBestValue(dealerHand);
  }
  endRound();
}

function isSoft17(hand) {
  let total = 0, aces = 0;
  hand.forEach(c => { total += c.value; if (c.rank === 'A') aces++; });
  while (aces > 0) {
    if (total === 17) return true;
    total -= 10;
    aces--;
  }
  return false;
}

function endRound(bust=false) {
  if (!handActive) return;
  gameOver = true;
  handActive = false;
  renderHands(false);
  updateHandValues(false);

  const playerVal = getBestValue(playerHand);
  const dealerVal = getBestValue(dealerHand);

  let outcome = '';
  if (bust) {
    outcome = 'lose';
  } else if (playerVal > 21) {
    outcome = 'lose';
  } else if (dealerVal > 21) {
    outcome = 'win';
  } else if (playerVal > dealerVal) {
    outcome = 'win';
  } else if (playerVal < dealerVal) {
    outcome = 'lose';
  } else {
    outcome = 'push';
  }

  let payout = 0;
  if (outcome === 'win') {
    if (playerHand.length === 2 && playerVal === 21) {
      payout = Math.floor(currentBet * 2.5); // 3:2
      showMessage('Blackjack! Kazandın (3:2).', 'win');
      playSound('blackjack');
    } else {
      payout = currentBet * 2;
      showMessage('Kazandın!', 'win');
      playSound('win');
    }
    balance += payout;
  } else if (outcome === 'push') {
    payout = currentBet;
    balance += payout;
    showMessage('Berabere (Push) - Bahis iade.', 'push');
    playSound('push');
  } else {
    showMessage('Kaybettin.', 'lose');
    playSound('lose');
  }

  updateBalance();
  updateStats(outcome);
  enableActionButtons(false);
  newRoundBtn.disabled = false;
  dealBtn.disabled = false;
  flashResult(outcome);
}

function surrenderAndNewRound() {
  // Teslim: Bahsin yarısı iade, kayıp sayılır
  const refund = Math.floor(currentBet / 2);
  balance += refund;
  updateBalance();
  stats.games++;
  stats.losses++;
  renderStats();
  showMessage(`Teslim oldun. ${refund}$ iade. Yeni tura hazırsın.`, 'warn');
  endHandStateReset();
}

function endHandStateReset() {
  gameOver = true;
  handActive = false;
  enableActionButtons(false);
  dealBtn.disabled = false;
  newRoundBtn.disabled = false;
}

function flashResult(outcome) {
  const table = document.querySelector('.table');
  table.classList.remove('flash-win','flash-lose');
  void table.offsetWidth;
  if (outcome === 'win') table.classList.add('flash-win');
  if (outcome === 'lose') table.classList.add('flash-lose');
}

function clearHands() {
  dealerCardsEl.innerHTML = '';
  playerCardsEl.innerHTML = '';
  dealerValueEl.textContent = '';
  playerValueEl.textContent = '';
}

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message';
  if (type === 'win') messageEl.style.borderColor = '#2f9e44';
  else if (type === 'lose') messageEl.style.borderColor = '#e03131';
  else if (type === 'warn') messageEl.style.borderColor = '#f08c00';
  else if (type === 'push') messageEl.style.borderColor = '#228be6';
  else messageEl.style.borderColor = 'rgba(255,255,255,.08)';
}

function updateBalance() {
  balanceEl.textContent = balance;
}

function enableActionButtons(inRound) {
  hitBtn.disabled = !inRound;
  standBtn.disabled = !inRound;
  doubleBtn.disabled = !inRound;
}

function attachBetButtons() {
  document.querySelectorAll('.bet-buttons button[data-bet]').forEach(btn => {
    btn.addEventListener('click', () => {
      let add = parseInt(btn.dataset.bet,10);
      let newVal = parseInt(betInput.value,10) + add;
      if (newVal > balance) newVal = balance;
      betInput.value = newVal;
    });
  });
  document.getElementById('clearBet').addEventListener('click', () => {
    betInput.value = 10;
  });
}

function attachEvents() {
  dealBtn.addEventListener('click', startHand);
  hitBtn.addEventListener('click', hit);
  standBtn.addEventListener('click', stand);
  doubleBtn.addEventListener('click', doubleDown);
  newRoundBtn.addEventListener('click', () => {
    if (handActive && !gameOver) {
      const ok = confirm('Bu turu Teslim (Surrender) edip yeni tur başlatmak istiyor musun? (Bahsin yarısı iade olur)');
      if (ok) {
        surrenderAndNewRound();
        prepareNewRoundUI();
      }
    } else {
      prepareNewRoundUI();
      showMessage('Bahis ayarla ve Dağıt.', '');
    }
  });
  newGameBtn.addEventListener('click', () => {
    const ok = confirm('Yeni Oyun? Bakiye ve istatistikler sıfırlanacak.');
    if (!ok) return;
    resetFullGame();
  });
  soundToggle.addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
  });
}

function prepareNewRoundUI() {
  clearHands();
  dealerHand = [];
  playerHand = [];
  gameOver = false;
  playerStood = false;
  handActive = false;
  enableActionButtons(false);
  dealBtn.disabled = false;
}

function resetFullGame() {
  balance = 1000;
  stats = {games:0,wins:0,losses:0,pushes:0};
  renderStats();
  updateBalance();
  prepareNewRoundUI();
  showMessage('Yeni Oyun! Bahis gir ve Dağıt.', '');
}

function updateStats(outcome) {
  stats.games++;
  if (outcome === 'win') stats.wins++;
  else if (outcome === 'lose') stats.losses++;
  else if (outcome === 'push') stats.pushes++;
  renderStats();
}

function renderStats() {
  gamesPlayedEl.textContent = stats.games;
  winsEl.textContent = stats.wins;
  lossesEl.textContent = stats.losses;
  pushesEl.textContent = stats.pushes;
  const rate = stats.games === 0 ? 0 : ((stats.wins / stats.games) * 100).toFixed(1);
  winRateEl.textContent = rate + '%';
}

// Kullanıcı ilk tıklayana kadar bazı tarayıcılarda AudioContext bekler; startHand ilk tetiklemede initAudioContext çağırılıyor.

// Son