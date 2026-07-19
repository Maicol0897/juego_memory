// ==========================
// ELEMENTOS DEL HTML
// ==========================
const tablero = document.querySelector(".game-board");
const botonStart = document.querySelector(".start-btn");
const botonRestart = document.querySelector(".restart-btn");
const dificultad = document.querySelector("#difficulty");
const timerDisplay = document.querySelector("#timer");

const leaderboardBody = document.querySelector("#leaderboard-body");
const leaderboardDifficultyLabel = document.querySelector("#leaderboard-difficulty");

const nameModal = document.querySelector("#name-modal");
const modalMessage = document.querySelector("#modal-message");
const playerNameInput = document.querySelector("#player-name");
const saveScoreBtn = document.querySelector("#save-score-btn");
const cancelScoreBtn = document.querySelector("#cancel-score-btn");

const winModal = document.querySelector("#win-modal");
const winMessage = document.querySelector("#win-message");
const closeWinBtn = document.querySelector("#close-win-btn");

// ==========================
// IMÁGENES DEL JUEGO
// ==========================
const imagenes = [
    
    "img/moto1.png",
    "img/moto2.png",
    "img/moto3.png",
    "img/moto4.png",
    "img/moto5.png",
    "img/moto6.png",
    "img/moto7.png",
    "img/moto8.png",
    "img/moto9.png",
    "img/moto10.png"

];

let primeraCarta = null;
let segundaCarta = null;
let bloqueado = false;
let paresEncontrados = 0;
let totalParejas = 0;
let juegoActivo = false;

let intervaloTimer = null;
let segundos = 0;

const LEADERBOARD_KEY = "memoryGameLeaderboard";

// ==========================
// SONIDOS (generados con Web Audio API, sin archivos externos)
// ==========================
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function reproducirTono(frecuencia, duracion, tipo = "sine", volumen = 0.2) {
    try {
        const ctx = getAudioCtx();
        const oscilador = ctx.createOscillator();
        const ganancia = ctx.createGain();

        oscilador.type = tipo;
        oscilador.frequency.setValueAtTime(frecuencia, ctx.currentTime);

        ganancia.gain.setValueAtTime(volumen, ctx.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracion);

        oscilador.connect(ganancia);
        ganancia.connect(ctx.destination);

        oscilador.start();
        oscilador.stop(ctx.currentTime + duracion);
    } catch (e) {
        // Si el navegador bloquea audio antes de interacción, simplemente no suena
    }
}

function sonidoVoltear() {
    reproducirTono(500, 0.1, "triangle", 0.15);
}

function sonidoMatch() {
    reproducirTono(700, 0.12, "sine", 0.2);
    setTimeout(() => reproducirTono(1000, 0.15, "sine", 0.2), 100);
}

function sonidoError() {
    reproducirTono(200, 0.25, "sawtooth", 0.15);
}

function sonidoVictoria() {
    const notas = [523, 659, 784, 1047];
    notas.forEach((nota, i) => {
        setTimeout(() => reproducirTono(nota, 0.25, "sine", 0.2), i * 150);
    });
}

// ==========================
// LEADERBOARD (localStorage)
// ==========================
function cargarLeaderboards() {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    if (!data) {
        return { easy: [], medium: [], hard: [], expert: [] };
    }
    return JSON.parse(data);
}

function guardarLeaderboards(data) {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(data));
}

function formatearTiempo(seg) {
    const min = Math.floor(seg / 60);
    const s = seg % 60;
    return min > 0 ? `${min}m ${s}s` : `${s}s`;
}

function renderLeaderboard() {
    const data = cargarLeaderboards();
    const nivel = dificultad.value;
    const lista = data[nivel] || [];

    leaderboardDifficultyLabel.textContent =
        `(${dificultad.options[dificultad.selectedIndex].text})`;

    leaderboardBody.innerHTML = "";

    if (lista.length === 0) {
        leaderboardBody.innerHTML = `<tr><td colspan="3">Aún no hay puntajes</td></tr>`;
        return;
    }

    lista.forEach((registro, index) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${index + 1}</td>
            <td>${registro.nombre}</td>
            <td>${formatearTiempo(registro.tiempo)}</td>
        `;
        leaderboardBody.appendChild(fila);
    });
}

function calificaParaRanking(tiempo, nivel) {
    const data = cargarLeaderboards();
    const lista = data[nivel] || [];
    if (lista.length < 10) return true;
    return tiempo < lista[lista.length - 1].tiempo;
}

function registrarPuntaje(nombre, tiempo, nivel) {
    const data = cargarLeaderboards();
    if (!data[nivel]) data[nivel] = [];

    data[nivel].push({ nombre: nombre || "Anónimo", tiempo });
    data[nivel].sort((a, b) => a.tiempo - b.tiempo);
    data[nivel] = data[nivel].slice(0, 10);

    guardarLeaderboards(data);
    renderLeaderboard();
}

// ==========================
// TIMER
// ==========================
function iniciarTimer() {
    detenerTimer();
    segundos = 0;
    timerDisplay.textContent = `Tiempo: ${segundos} s`;
    intervaloTimer = setInterval(() => {
        segundos++;
        timerDisplay.textContent = `Tiempo: ${segundos} s`;
    }, 1000);
}

function detenerTimer() {
    clearInterval(intervaloTimer);
}

// ==========================
// MODALES
// ==========================
function mostrarModalNombre() {
    playerNameInput.value = "";
    nameModal.classList.remove("hidden");
    playerNameInput.focus();
}

function ocultarModalNombre() {
    nameModal.classList.add("hidden");
}

function mostrarModalGanaste(tiempo) {
    winMessage.textContent = `Tu tiempo fue de ${formatearTiempo(tiempo)}.`;
    winModal.classList.remove("hidden");
}

function ocultarModalGanaste() {
    winModal.classList.add("hidden");
}

// ==========================
// FIN DEL JUEGO
// ==========================
function terminarJuego() {
    detenerTimer();
    juegoActivo = false;
    sonidoVictoria();

    const nivel = dificultad.value;

    if (calificaParaRanking(segundos, nivel)) {
        modalMessage.textContent =
            `¡Entraste al top 10 en dificultad ${dificultad.options[dificultad.selectedIndex].text}! Ingresa tu nombre:`;
        mostrarModalNombre();
    } else {
        mostrarModalGanaste(segundos);
    }
}

// ==========================
// FUNCIÓN PRINCIPAL DEL JUEGO
// ==========================
function iniciarJuego() {
    // Reinicia estado del juego
    primeraCarta = null;
    segundaCarta = null;
    bloqueado = false;
    paresEncontrados = 0;
    juegoActivo = true;

    let cantidadParejas = 0;

    if (dificultad.value === "easy") {
        cantidadParejas = 2;
    } else if (dificultad.value === "medium") {
        cantidadParejas = 4;
    } else if (dificultad.value === "hard") {
        cantidadParejas = 6;
    } else if (dificultad.value === "expert") {
        cantidadParejas = 10;
    }

    totalParejas = cantidadParejas;

    const cartasSeleccionadas = imagenes.slice(0, cantidadParejas);
    const cartasJuego = [...cartasSeleccionadas, ...cartasSeleccionadas];
    cartasJuego.sort(() => Math.random() - 0.5);

    tablero.innerHTML = "";

    cartasJuego.forEach((imgSrc) => {
        const carta = document.createElement("div");
        carta.classList.add("card");
        carta.dataset.imagen = imgSrc;

        carta.innerHTML = `
            <div class="card-inner">
                <div class="card-front"></div>
                <div class="card-back"><img src="${imgSrc}" alt="carta"></div>
            </div>
        `;

        carta.addEventListener("click", () => manejarClicCarta(carta));
        tablero.appendChild(carta);
    });

    renderLeaderboard();
    iniciarTimer();
}

function manejarClicCarta(carta) {
    if (!juegoActivo) return;
    if (bloqueado) return;
    if (carta === primeraCarta) return;
    if (carta.classList.contains("matched")) return;

    carta.classList.add("flipped");
    sonidoVoltear();

    if (primeraCarta === null) {
        primeraCarta = carta;
        return;
    }

    segundaCarta = carta;
    bloqueado = true;

    if (primeraCarta.dataset.imagen === segundaCarta.dataset.imagen) {
        primeraCarta.classList.add("matched");
        segundaCarta.classList.add("matched");

        sonidoMatch();

        paresEncontrados++;

        primeraCarta = null;
        segundaCarta = null;
        bloqueado = false;

        if (paresEncontrados === totalParejas) {
            setTimeout(terminarJuego, 300);
        }
    } else {
        sonidoError();

        setTimeout(() => {
            primeraCarta.classList.remove("flipped");
            segundaCarta.classList.remove("flipped");

            primeraCarta = null;
            segundaCarta = null;
            bloqueado = false;
        }, 900);
    }
}

// ==========================
// EVENTOS
// ==========================
botonStart.addEventListener("click", iniciarJuego);
botonRestart.addEventListener("click", iniciarJuego);

dificultad.addEventListener("change", renderLeaderboard);

saveScoreBtn.addEventListener("click", () => {
    const nombre = playerNameInput.value.trim();
    registrarPuntaje(nombre, segundos, dificultad.value);
    ocultarModalNombre();
});

cancelScoreBtn.addEventListener("click", ocultarModalNombre);
closeWinBtn.addEventListener("click", ocultarModalGanaste);

// Carga inicial del leaderboard al abrir la página
renderLeaderboard();