import { auth, db } from "./Firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  ref, set, update, get, child, query, orderByChild
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

/* --------- Helpers/UI --------- */
const $ = (s)=>document.querySelector(s);

const loginContainer = $("#loginContainer");
const appSection     = $("#appSection");
const authForm       = $("#authForm");
const authMsg        = $("#authMsg");
const authAlert      = $("#authAlert");
const welcome        = $("#welcome");

const inpUser        = $("#usernameInput");
const inpPass        = $("#passwordInput");
const loginButton    = $("#loginButton");
const registerButton = $("#registerButton");
const resetPwdButton = $("#resetPwdButton");
const logoutButton   = $("#logoutButton");

const btnRefresh     = $("#btnRefresh");
const tblBody        = $("#tblBody");
const listMsg        = $("#listMsg");

const btnStart       = $("#btnStart");
const updateMsg      = $("#updateMsg");

const hudTime = $("#hudTime");
const hudHits = $("#hudHits");
const hudShots= $("#hudShots");
const hudAcc  = $("#hudAcc");
const hudScore= $("#hudScore");

function showAuth(){ loginContainer.classList.remove("hidden"); appSection.classList.add("hidden"); authMsg.textContent=""; clearAlert(); }
function showApp(){  loginContainer.classList.add("hidden");   appSection.classList.remove("hidden"); welcome.textContent = `Hola, ${storage.username || "usuario"}`; }
function showAlert(type, text){ authAlert.innerHTML = `<div class="alert ${type === "error" ? "alert--error" : "alert--success"}">${text}</div>`; }
function clearAlert(){ authAlert.innerHTML = ""; }
function markInvalid(el){ el.classList.remove("is-valid"); el.classList.add("is-invalid"); }
function markValid(el){   el.classList.remove("is-invalid"); el.classList.add("is-valid"); }
function resetFieldStates(){ [inpUser, inpPass].forEach(el=>el.classList.remove("is-valid","is-invalid")); }
function shake(el){ el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }

const storage = {
  get token(){ return localStorage.getItem("sid_token") || ""; },
  set token(v){ v ? localStorage.setItem("sid_token", v) : localStorage.removeItem("sid_token"); },
  get username(){ return localStorage.getItem("sid_username") || ""; },
  set username(v){ v ? localStorage.setItem("sid_username", v) : localStorage.removeItem("sid_username"); }
};

/* --------- Servicios Firebase --------- */
const usernameFromInput = (u)=> u?.includes("@") ? u.split("@")[0] : (u||"usuario");

async function apiRegister(emailLike, password){
  const cred = await createUserWithEmailAndPassword(auth, emailLike, password);
  const uid  = cred.user.uid;
  const username = usernameFromInput(emailLike);
  await set(ref(db, `users/${uid}`), { username, score: 0, createdAt: Date.now() });
  const token = await cred.user.getIdToken();
  return { token, usuario: { username, uid } };
}

async function apiLogin(emailLike, password){
  const cred = await signInWithEmailAndPassword(auth, emailLike, password);
  const uid  = cred.user.uid;
  const snap = await get(child(ref(db), `users/${uid}/username`));
  const username = snap.exists() ? snap.val() : usernameFromInput(emailLike);
  const token = await cred.user.getIdToken();
  return { token, usuario: { username, uid } };
}

async function apiUpdateScore(score, stats){
  const u = auth.currentUser;
  if (!u) throw new Error("No autenticado");
  await update(ref(db, `users/${u.uid}`), {
    score: Number(score),
    lastPlayed: Date.now(),
    ...stats
  });
}

async function apiListUsers(){
  try {
    const q = query(ref(db, "users"), orderByChild("score"));
    const snap = await get(q);
    const list = snap.exists() ? Object.values(snap.val()) : [];
    return list;
  } catch {
    const snap = await get(ref(db, "users"));
    const list = snap.exists() ? Object.values(snap.val()) : [];
    return list;
  }
}

/* --------- Auth UI --------- */
loginButton.addEventListener("click", async (e)=>{
  e.preventDefault(); clearAlert(); authMsg.textContent = "";

  const u = inpUser.value.trim();
  const p = inpPass.value;

  let ok = true;
  if (!u || !u.includes("@")){ markInvalid(inpUser); ok = false; } else { markValid(inpUser); }
  if ((p||"").length < 6){ markInvalid(inpPass); ok = false; } else { markValid(inpPass); }
  if (!ok){ showAlert("error","Usa un email válido y contraseña mínimo 6 caracteres."); shake(authForm); return; }

  authMsg.textContent = "Autenticando...";
  try{
    const data = await apiLogin(u, p);
    storage.token = data.token;
    storage.username = data?.usuario?.username ?? usernameFromInput(u);
    authMsg.textContent = "";
  }catch{
    showAlert("error","Usuario o contraseña incorrectos.");
    shake(authForm); authMsg.textContent = ""; markInvalid(inpUser); markInvalid(inpPass);
  }
});

registerButton.addEventListener("click", async ()=>{
  clearAlert(); authMsg.textContent = "";

  const u = inpUser.value.trim();
  const p = inpPass.value;

  let ok = true;
  if (!u || !u.includes("@")){ markInvalid(inpUser); ok = false; } else { markValid(inpUser); }
  if ((p||"").length < 6){ markInvalid(inpPass); ok = false; } else { markValid(inpPass); }
  if (!ok){ showAlert("error","Usa un email válido y contraseña mínimo 6 caracteres."); shake(authForm); return; }

  authMsg.textContent = "Registrando...";
  try{
    const r = await apiRegister(u, p);
    storage.token = r.token;
    storage.username = r?.usuario?.username ?? usernameFromInput(u);
    showAlert("success","Registrado y autenticado.");
    authMsg.textContent = "";
  }catch{
    authMsg.textContent = "";
    showAlert("error","No se pudo registrar (¿email ya existe?).");
    shake(authForm); markInvalid(inpUser); markInvalid(inpPass);
  }
});

resetPwdButton.addEventListener("click", async ()=>{
  clearAlert(); authMsg.textContent="";
  const email = inpUser.value.trim();
  if (!email || !email.includes("@")){ markInvalid(inpUser); showAlert("error","Escribe tu email para recuperar."); return; }
  try{
    await sendPasswordResetEmail(auth, email);
    showAlert("success","Te enviamos un enlace para restablecer tu contraseña.");
  }catch{
    showAlert("error","No se pudo enviar el correo de recuperación.");
  }
});

logoutButton.addEventListener("click", async ()=>{
  await signOut(auth);
  storage.token=""; storage.username="";
  clearAlert(); authMsg.textContent=""; resetFieldStates(); showAuth();
});

onAuthStateChanged(auth, async (u)=>{
  if (u){
    const token = await u.getIdToken();
    storage.token = token;
    const s = await get(child(ref(db), `users/${u.uid}/username`));
    storage.username = s.exists() ? s.val() : (u.email ? u.email.split("@")[0] : "usuario");
    showApp();
    loadLeaderboard();
  }else{
    storage.token=""; storage.username="";
    showAuth();
  }
});

/* --------- Leaderboard --------- */
btnRefresh.addEventListener("click", loadLeaderboard);

async function loadLeaderboard(){
  listMsg.textContent = "Cargando...";
  tblBody.innerHTML = "";
  try {
    const users = (await apiListUsers())
      .map(u => ({ username: u.username ?? "-", score: Number(u.score ?? 0) }))
      .sort((a,b)=> b.score - a.score);
    users.forEach((u,i)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i+1}</td><td>${u.username}</td><td>${u.score}</td>`;
      tblBody.appendChild(tr);
    });
    listMsg.textContent = `Total: ${users.length}`;
  } catch (err){
    listMsg.textContent = `Error al listar: ${err.message}`;
  }
}

/* --------- NUEVO JUEGO: TRIKI RÁPIDO --------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function fitCanvas(){
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));
}
fitCanvas();
addEventListener("resize", fitCanvas);

let game = null;
const BOARD_SIZE = 3;
const PLAYER_X = 'X';
const PLAYER_O = 'O';
const EMPTY = '';

let currentPlayer = PLAYER_X;
let board = [];
let gameActive = false;
let moves = 0;
let startTime = 0;
let timerInterval = null;

// Inicializar tablero
function initializeBoard() {
  board = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    board[i] = [];
    for (let j = 0; j < BOARD_SIZE; j++) {
      board[i][j] = EMPTY;
    }
  }
}

// Dibujar el tablero
function drawBoard() {
  const width = canvas.width;
  const height = canvas.height;
  const cellWidth = width / BOARD_SIZE;
  const cellHeight = height / BOARD_SIZE;

  // Fondo
  ctx.fillStyle = 'rgba(15, 15, 26, 0.9)';
  ctx.fillRect(0, 0, width, height);

  // Líneas del tablero
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
  ctx.lineWidth = 3;

  // Líneas verticales
  for (let i = 1; i < BOARD_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellWidth, 0);
    ctx.lineTo(i * cellWidth, height);
    ctx.stroke();
  }

  // Líneas horizontales
  for (let i = 1; i < BOARD_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cellHeight);
    ctx.lineTo(width, i * cellHeight);
    ctx.stroke();
  }

  // Dibujar X y O
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      const x = j * cellWidth + cellWidth / 2;
      const y = i * cellHeight + cellHeight / 2;
      const radius = Math.min(cellWidth, cellHeight) * 0.3;

      if (board[i][j] === PLAYER_X) {
        // Dibujar X
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - radius, y - radius);
        ctx.lineTo(x + radius, y + radius);
        ctx.moveTo(x + radius, y - radius);
        ctx.lineTo(x - radius, y + radius);
        ctx.stroke();
      } else if (board[i][j] === PLAYER_O) {
        // Dibujar O
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

// Verificar ganador
function checkWinner() {
  // Filas
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (board[i][0] !== EMPTY && 
        board[i][0] === board[i][1] && 
        board[i][1] === board[i][2]) {
      return board[i][0];
    }
  }

  // Columnas
  for (let j = 0; j < BOARD_SIZE; j++) {
    if (board[0][j] !== EMPTY && 
        board[0][j] === board[1][j] && 
        board[1][j] === board[2][j]) {
      return board[0][j];
    }
  }

  // Diagonales
  if (board[0][0] !== EMPTY && 
      board[0][0] === board[1][1] && 
      board[1][1] === board[2][2]) {
    return board[0][0];
  }

  if (board[0][2] !== EMPTY && 
      board[0][2] === board[1][1] && 
      board[1][1] === board[2][0]) {
    return board[0][2];
  }

  // Empate
  if (moves === BOARD_SIZE * BOARD_SIZE) {
    return 'TIE';
  }

  return null;
}

// Hacer movimiento de la IA
function makeAIMove() {
  // Buscar movimiento ganador
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === EMPTY) {
        board[i][j] = PLAYER_O;
        if (checkWinner() === PLAYER_O) {
          return;
        }
        board[i][j] = EMPTY;
      }
    }
  }

  // Bloquear jugador
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === EMPTY) {
        board[i][j] = PLAYER_X;
        if (checkWinner() === PLAYER_X) {
          board[i][j] = PLAYER_O;
          return;
        }
        board[i][j] = EMPTY;
      }
    }
  }

  // Movimiento aleatorio
  const emptyCells = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === EMPTY) {
        emptyCells.push({ i, j });
      }
    }
  }

  if (emptyCells.length > 0) {
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    board[randomCell.i][randomCell.j] = PLAYER_O;
  }
}

// Calcular puntuación
function calculateScore(winner, timeElapsed, movesMade) {
  let baseScore = 0;
  
  if (winner === PLAYER_X) {
    baseScore = 1000; // Victoria
  } else if (winner === 'TIE') {
    baseScore = 300; // Empate
  } else {
    baseScore = 50; // Derrota
  }

  // Bonus por rapidez (máximo 500 puntos)
  const timeBonus = Math.max(0, 500 - (timeElapsed * 10));
  
  // Bonus por eficiencia (menos movimientos = mejor)
  const efficiencyBonus = Math.max(0, 300 - (movesMade * 20));

  return baseScore + timeBonus + efficiencyBonus;
}

// Actualizar HUD
function updateHUD(timeElapsed) {
  hudTime.textContent = timeElapsed.toFixed(1);
  hudHits.textContent = game?.wins || 0;
  hudShots.textContent = moves;
  hudAcc.textContent = game?.wins ? `${((game.wins / moves) * 100).toFixed(0)}%` : '0%';
  hudScore.textContent = Math.round(calculateScore(
    game?.winner, 
    timeElapsed, 
    moves
  ));
}

// Iniciar juego
function startGame() {
  initializeBoard();
  currentPlayer = PLAYER_X;
  gameActive = true;
  moves = 0;
  startTime = performance.now();
  
  game = {
    running: true,
    startedAt: startTime,
    wins: 0,
    moves: 0,
    winner: null
  };

  updateMsg.textContent = "¡Tu turno! Eres las X";
  drawBoard();

  // Timer de actualización
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameActive) {
      const currentTime = (performance.now() - startTime) / 1000;
      updateHUD(currentTime);
    }
  }, 100);
}

// Finalizar juego
async function endGame(winner) {
  gameActive = false;
  clearInterval(timerInterval);
  
  const endTime = performance.now();
  const timeElapsed = (endTime - startTime) / 1000;
  
  game.winner = winner;
  game.running = false;

  let message = "";
  if (winner === PLAYER_X) {
    message = "¡Ganaste! 🎉";
    game.wins++;
  } else if (winner === PLAYER_O) {
    message = "La IA ganó 🤖";
  } else {
    message = "¡Empate! 🤝";
  }

  updateMsg.textContent = `${message} Tiempo: ${timeElapsed.toFixed(1)}s`;

  // Calcular puntuación final
  const finalScore = Math.round(calculateScore(winner, timeElapsed, moves));
  
  updateMsg.textContent += ` - Puntuación: ${finalScore}. Guardando...`;

  try {
    await apiUpdateScore(finalScore, {
      time: timeElapsed.toFixed(1),
      moves: moves,
      result: winner === PLAYER_X ? 'win' : (winner === 'TIE' ? 'tie' : 'loss'),
      wins: game.wins
    });
    updateMsg.textContent = `${message} - Puntuación: ${finalScore} ✓`;
    await loadLeaderboard();
  } catch (err) {
    updateMsg.textContent = `Error al guardar: ${err.message}`;
  }
}

// Manejar clic en el canvas
canvas.addEventListener("click", (e) => {
  if (!gameActive || currentPlayer !== PLAYER_X) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const cellWidth = canvas.width / BOARD_SIZE;
  const cellHeight = canvas.height / BOARD_SIZE;

  const col = Math.floor(x / cellWidth);
  const row = Math.floor(y / cellHeight);

  if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === EMPTY) {
    // Movimiento del jugador
    board[row][col] = PLAYER_X;
    moves++;
    drawBoard();

    const winner = checkWinner();
    if (winner) {
      endGame(winner);
      return;
    }

    currentPlayer = PLAYER_O;
    updateMsg.textContent = "Turno de la IA...";

    // Movimiento de la IA después de un breve delay
    setTimeout(() => {
      if (gameActive) {
        makeAIMove();
        moves++;
        drawBoard();

        const winner = checkWinner();
        if (winner) {
          endGame(winner);
          return;
        }

        currentPlayer = PLAYER_X;
        updateMsg.textContent = "¡Tu turno!";
      }
    }, 800);
  }
});

// Iniciar juego cuando se hace clic en el botón
btnStart.addEventListener("click", startGame);

// Dibujar tablero inicial
drawBoard();