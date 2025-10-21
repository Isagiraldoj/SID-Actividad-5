import { auth, db } from "./firebase.js";
await set(ref(db, "testConnection"), { mensaje: "Firebase conectado correctamente ✅" });
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  ref, set, get, child, query, orderByChild
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

/* --------- Elementos --------- */
const $ = (s) => document.querySelector(s);

const loginContainer = $("#loginContainer");
const appSection = $("#appSection");
const authForm = $("#authForm");
const authMsg = $("#authMsg");
const authAlert = $("#authAlert");
const welcome = $("#welcome");

const inpUser = $("#usernameInput");
const inpPass = $("#passwordInput");
const loginButton = $("#loginButton");
const registerButton = $("#registerButton");
const resetPwdButton = $("#resetPwdButton");
const logoutButton = $("#logoutButton");

const btnRefresh = $("#btnRefresh");
const tblBody = $("#tblBody");
const listMsg = $("#listMsg");

const btnStart = $("#btnStart");
const updateMsg = $("#updateMsg");
const hudTime = $("#hudTime");
const hudScore = $("#hudScore");

/* --------- Helpers --------- */
const storage = {
  get token() { return localStorage.getItem("sid_token") || ""; },
  set token(v) { v ? localStorage.setItem("sid_token", v) : localStorage.removeItem("sid_token"); },
  get username() { return localStorage.getItem("sid_username") || ""; },
  set username(v) { v ? localStorage.setItem("sid_username", v) : localStorage.removeItem("sid_username"); },
};

function showAuth() { loginContainer.classList.remove("hidden"); appSection.classList.add("hidden"); }
function showApp() { loginContainer.classList.add("hidden"); appSection.classList.remove("hidden"); welcome.textContent = `Hola, ${storage.username}`; }
function showAlert(type, text) {
  authAlert.innerHTML = `<div class="alert ${type === "error" ? "alert--error" : "alert--success"}">${text}</div>`;
}
function clearAlert() { authAlert.innerHTML = ""; }

/* --------- Firebase Auth --------- */
async function apiRegister(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const username = email.split("@")[0];
  await set(ref(db, `users/${uid}`), { username, score: 0, createdAt: Date.now() });
  const token = await cred.user.getIdToken();
  return { token, usuario: { username, uid } };
}

async function apiLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const snap = await get(child(ref(db), `users/${uid}/username`));
  const username = snap.exists() ? snap.val() : email.split("@")[0];
  const token = await cred.user.getIdToken();
  return { token, usuario: { username, uid } };
}

async function apiUpdateScore(score) {
  const u = auth.currentUser;
  if (!u) throw new Error("No autenticado");
  await update(ref(db, `users/${u.uid}`), { score, lastPlayed: Date.now() });
}

async function apiListUsers() {
  const q = query(ref(db, "users"), orderByChild("score"));
  const snap = await get(q);
  const list = snap.exists() ? Object.values(snap.val()) : [];
  return list.sort((a, b) => b.score - a.score);
}

/* --------- Eventos Auth --------- */
loginButton.addEventListener("click", async (e) => {
  e.preventDefault(); clearAlert(); authMsg.textContent = "";
  const u = inpUser.value.trim(), p = inpPass.value;
  if (!u.includes("@") || p.length < 6) { showAlert("error", "Email o contraseña inválidos."); return; }
  authMsg.textContent = "Autenticando...";
  try {
    const data = await apiLogin(u, p);
    storage.token = data.token; storage.username = data.usuario.username;
  } catch {
    showAlert("error", "Error de autenticación.");
  }
});

registerButton.addEventListener("click", async () => {
  clearAlert(); authMsg.textContent = "";
  const u = inpUser.value.trim(), p = inpPass.value;
  if (!u.includes("@") || p.length < 6) { showAlert("error", "Email o contraseña inválidos."); return; }
  try {
    const r = await apiRegister(u, p);
    storage.token = r.token; storage.username = r.usuario.username;
    showAlert("success", "Usuario registrado correctamente.");
  } catch {
    showAlert("error", "No se pudo registrar.");
  }
});

resetPwdButton.addEventListener("click", async () => {
  const email = inpUser.value.trim();
  if (!email.includes("@")) return showAlert("error", "Escribe tu email.");
  await sendPasswordResetEmail(auth, email);
  showAlert("success", "Correo de recuperación enviado.");
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth); storage.token = ""; storage.username = ""; showAuth();
});

onAuthStateChanged(auth, async (u) => {
  if (u) { storage.username = u.email.split("@")[0]; showApp(); loadLeaderboard(); }
  else { showAuth(); }
});

/* --------- Leaderboard --------- */
btnRefresh.addEventListener("click", loadLeaderboard);
async function loadLeaderboard() {
  listMsg.textContent = "Cargando...";
  tblBody.innerHTML = "";
  const users = await apiListUsers();
  users.forEach((u, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${u.username}</td><td>${u.score ?? 0}</td>`;
    tblBody.appendChild(tr);
  });
  listMsg.textContent = `Total: ${users.length}`;
}

/* --------- Minijuego: Catcher --------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width; canvas.height = rect.height;
}
fitCanvas(); addEventListener("resize", fitCanvas);

let game = null;
btnStart.addEventListener("click", startGame);

function startGame() {
  fitCanvas();
  game = { playerX: canvas.width / 2, score: 0, balls: [], time: 15, running: true, start: performance.now() };
  updateMsg.textContent = "¡Atrapa los círculos!";
  requestAnimationFrame(loop);
}

function loop() {
  if (!game?.running) return;
  const now = performance.now();
  const elapsed = (now - game.start) / 1000;
  game.time = Math.max(0, 15 - elapsed);
  if (game.time <= 0) return endGame();
  if (Math.random() < 0.04) spawnBall();

  update(); draw();
  requestAnimationFrame(loop);
}

function spawnBall() {
  const x = Math.random() * canvas.width;
  game.balls.push({ x, y: 0, r: 10, vy: 3 + Math.random() * 2 });
}

function update() {
  game.balls.forEach(b => b.y += b.vy);
  const playerY = canvas.height - 30;
  game.balls = game.balls.filter(b => {
    const hit = Math.abs(b.x - game.playerX) < 25 && Math.abs(b.y - playerY) < 20;
    if (hit) game.score += 10;
    return b.y < canvas.height && !hit;
  });
  hudTime.textContent = game.time.toFixed(1);
  hudScore.textContent = game.score;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#eef3f8"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0077cc";       
  game.balls.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = "#444"; ctx.fillRect(                                                              game.playerX - 25, canvas.height - 30, 50, 12);
}

document.addEventListener("keydown", (e) => {
  if (!game?.running) return;
  if (e.key === "ArrowLeft") game.playerX -= 30;
  if (e.key === "ArrowRight") game.playerX += 30;
});

async function endGame() {
  game.running = false;
  updateMsg.textContent = `Juego terminado. Puntaje: ${game.score}`;
  try {
    await apiUpdateScore(game.score);                                                                                    me.score);
    await loadLeaderboard();
  } catch (err) {
    updateMsg.textContent = "Error al guardar puntaje.";
  }
}
