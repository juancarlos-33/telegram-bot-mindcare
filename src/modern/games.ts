import type { Context } from "telegraf";
import { addScore, saveGameEvent } from "./db.js";

type Trivia = {
  question: string;
  options: [string, string, string];
  answer: "a" | "b" | "c";
};

type OpenQuestion = {
  question: string;
  answer: string;
};

type GuessState = {
  secret: number;
  attempts: number;
};

type HangmanState = {
  word: string;
  lives: number;
  letters: Set<string>;
};

type PairScore = {
  names: string;
  points: number;
};

type PairCompetition = {
  pairs: PairScore[];
  index: number;
  current?: OpenQuestion;
};

const triviaByChat = new Map<number, Trivia>();
const guesses = new Map<number, GuessState>();
const hangman = new Map<number, HangmanState>();
const pairCompetitions = new Map<number, PairCompetition>();
const dailyMissions = new Map<string, { date: string; text: string; done: boolean }>();

const trivias: Trivia[] = [
  { question: "¿Qué plataforma se usará para desplegar el bot?", options: ["Railway", "Photoshop", "Excel"], answer: "a" },
  { question: "¿Qué base de datos se usará para guardar información?", options: ["Paint", "Neon PostgreSQL", "Bloc de notas"], answer: "b" },
  { question: "¿Qué servicio permite revisar repositorios y commits?", options: ["GitHub", "YouTube", "Telegram"], answer: "a" },
  { question: "¿Qué mecanismo permite autorizar apps sin entregar contraseña?", options: ["OAuth", "Captura de pantalla", "Audio"], answer: "a" },
  { question: "¿Qué API permite buscar videos y canales?", options: ["Calendar API", "YouTube Data API", "Mapas"], answer: "b" }
];

const pairQuestions: OpenQuestion[] = [
  { question: "¿Qué plataforma aloja el bot?", answer: "railway" },
  { question: "¿Qué base de datos guarda los registros?", answer: "neon" },
  { question: "¿Qué integración revisa commits?", answer: "github" },
  { question: "¿Qué integración consulta videos?", answer: "youtube" },
  { question: "¿Qué integración crea eventos?", answer: "calendar" },
  { question: "¿Qué flujo autoriza aplicaciones?", answer: "oauth" }
];

const words = ["telegram", "calendar", "github", "youtube", "railway", "neon", "usuario", "permiso"];
const truths = [
  "¿Qué módulo del proyecto explicarías primero al profesor?",
  "¿Qué integración te parece más importante?",
  "¿Qué dato guardarías sí o sí en Neon?",
  "¿Qué comando del bot usarías más?"
];
const dares = [
  "Explica OAuth en una frase.",
  "Di una mejora para el menú del bot.",
  "Nombra tres tablas de la base de datos.",
  "Resume el proyecto en 20 segundos."
];
const missions = [
  "Probar tres comandos del bot y anotar el resultado.",
  "Escribir un ejemplo de dato guardado en usuarios.",
  "Diseñar un caso de uso para GitHub.",
  "Verificar que /portal muestre autorización."
];

export function gamesMenu() {
  return [
    "🎮 Juegos del bot",
    "",
    "/trivia - Pregunta con opciones",
    "/ahorcado - Adivina la palabra",
    "/adivina - Número del 1 al 50",
    "/ppt piedra|papel|tijera",
    "/dado, /moneda, /8ball pregunta",
    "/ruleta Ana | Luis | Sofía",
    "/pareja Ana | Luis | Sofía",
    "/ship Ana | Luis",
    "/top tema | Ana | Luis | Sofía",
    "/verdad, /reto, /mision, /concurso",
    "/parejas iniciar Ana+Luis | Sofía+Carlos"
  ].join("\n");
}

export async function maybeHandleGameAnswer(ctx: Context, text: string) {
  const chatId = ctx.chat?.id;
  if (!chatId) return false;
  const normalized = normalize(text);

  if (triviaByChat.has(chatId) && ["a", "b", "c"].includes(normalized)) {
    const trivia = triviaByChat.get(chatId)!;
    if (normalized === trivia.answer) {
      triviaByChat.delete(chatId);
      const total = await addScore(ctx.from, "trivia", 1);
      await saveGameEvent(chatId, ctx.from?.id, "trivia", "respuesta correcta", 1);
      await ctx.reply(`✅ Correcto. +1 punto.${total === null ? "" : ` Total: ${total}`}`);
    } else {
      await ctx.reply("❌ Esa no es. Intenta otra vez con a, b o c.");
    }
    return true;
  }

  if (guesses.has(chatId) && /^\d+$/.test(normalized)) {
    const state = guesses.get(chatId)!;
    state.attempts += 1;
    const guess = Number(normalized);
    if (guess === state.secret) {
      guesses.delete(chatId);
      const points = Math.max(1, 6 - state.attempts);
      const total = await addScore(ctx.from, "adivina", points);
      await saveGameEvent(chatId, ctx.from?.id, "adivina", "numero adivinado", points);
      await ctx.reply(`✅ Era ${state.secret}. Ganaste ${points} puntos.${total === null ? "" : ` Total: ${total}`}`);
    } else if (state.attempts >= 6) {
      guesses.delete(chatId);
      await ctx.reply(`❌ Se acabaron los intentos. Era ${state.secret}.`);
    } else {
      await ctx.reply(guess < state.secret ? "📈 Más alto." : "📉 Más bajo.");
    }
    return true;
  }

  if (hangman.has(chatId) && normalized.length === 1) {
    await answerHangman(ctx, normalized);
    return true;
  }

  if (pairCompetitions.has(chatId) && !text.startsWith("/")) {
    await answerPairCompetition(ctx, text);
    return true;
  }

  return false;
}

export async function handleGameCommand(ctx: Context, command: string, arg: string) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  if (command === "trivia" || command === "concurso") {
    const q = random(trivias);
    triviaByChat.set(chatId, q);
    await ctx.reply(`🧠 ${command === "concurso" ? "Concurso rápido" : "Trivia"}\n\n${q.question}\nA) ${q.options[0]}\nB) ${q.options[1]}\nC) ${q.options[2]}\n\nResponde a, b o c.`);
    return;
  }

  if (command === "adivina") {
    guesses.set(chatId, { secret: rand(1, 50), attempts: 0 });
    await ctx.reply("🔢 Estoy pensando en un número del 1 al 50. Responde con un número.");
    return;
  }

  if (command === "ahorcado") {
    const state: HangmanState = { word: random(words), lives: 6, letters: new Set() };
    hangman.set(chatId, state);
    await ctx.reply(`🪢 Ahorcado\nPalabra: ${visibleWord(state)}\nVidas: ${state.lives}\nEnvía una letra.`);
    return;
  }

  if (command === "ppt") {
    await rockPaperScissors(ctx, arg);
    return;
  }

  if (command === "dado") {
    await ctx.reply(`🎲 Salió ${rand(1, 6)}`);
    return;
  }

  if (command === "moneda") {
    await ctx.reply(Math.random() < 0.5 ? "🪙 Cara" : "🪙 Sello");
    return;
  }

  if (command === "8ball") {
    if (!arg) await ctx.reply("Uso: /8ball ¿termino el proyecto hoy?");
    else await ctx.reply(`🎱 ${random(["Sí.", "Probablemente.", "Pregunta después de compilar.", "No lo veo claro.", "Con orden, sí."])}`);
    return;
  }

  if (command === "ruleta") {
    const options = parseList(arg);
    await ctx.reply(options.length < 2 ? "Uso: /ruleta opción 1 | opción 2" : `🎡 Ganó: ${random(options)}`);
    return;
  }

  if (command === "pareja") {
    const options = parseList(arg);
    if (options.length < 2) await ctx.reply("Uso: /pareja Ana | Luis | Sofía");
    else await ctx.reply(`💞 Pareja: ${pick(options)} + ${pick(options)}`);
    return;
  }

  if (command === "ship") {
    const names = parseList(arg).length >= 2 ? parseList(arg) : arg.split(/\s+/).filter(Boolean);
    if (names.length < 2) await ctx.reply("Uso: /ship Ana | Luis");
    else {
      const pct = Math.abs((normalize(names[0]) + normalize(names[1])).split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 101;
      await ctx.reply(`💘 ${names[0]} + ${names[1]} = ${pct}% de compatibilidad.`);
    }
    return;
  }

  if (command === "top") {
    const parts = parseList(arg);
    if (parts.length < 3) await ctx.reply("Uso: /top tema | Ana | Luis | Sofía");
    else {
      const topic = parts.shift();
      await ctx.reply(`🏅 Top ${topic}\n${parts.sort(() => Math.random() - 0.5).slice(0, 5).map((x, i) => `${i + 1}. ${x}`).join("\n")}`);
    }
    return;
  }

  if (command === "verdad") {
    await ctx.reply(`🎤 Verdad:\n${random(truths)}`);
    return;
  }

  if (command === "reto") {
    await ctx.reply(`⚡ Reto:\n${random(dares)}`);
    return;
  }

  if (command === "mision") {
    await dailyMission(ctx, arg);
    return;
  }

  if (command === "parejas") {
    await pairCompetition(ctx, arg);
  }
}

async function rockPaperScissors(ctx: Context, arg: string) {
  const options = ["piedra", "papel", "tijera"];
  const user = normalize(arg);
  if (!options.includes(user)) {
    await ctx.reply("Uso: /ppt piedra, /ppt papel o /ppt tijera");
    return;
  }
  const bot = random(options);
  if (user === bot) {
    await ctx.reply(`Tú: ${user}\nBot: ${bot}\n🤝 Empate.`);
  } else if ((options.indexOf(user) - options.indexOf(bot) + 3) % 3 === 1) {
    const total = await addScore(ctx.from, "ppt", 1);
    await ctx.reply(`Tú: ${user}\nBot: ${bot}\n🎉 Ganaste. +1 punto.${total === null ? "" : ` Total: ${total}`}`);
  } else {
    await ctx.reply(`Tú: ${user}\nBot: ${bot}\n🤖 Ganó el bot.`);
  }
}

async function answerHangman(ctx: Context, letter: string) {
  const chatId = ctx.chat!.id;
  const state = hangman.get(chatId)!;
  if (state.letters.has(letter)) {
    await ctx.reply(`Ya probaste esa letra.\n${visibleWord(state)}`);
    return;
  }
  state.letters.add(letter);
  if (!state.word.includes(letter)) state.lives -= 1;
  if (state.word.split("").every((char) => state.letters.has(char))) {
    hangman.delete(chatId);
    const total = await addScore(ctx.from, "ahorcado", 4);
    await ctx.reply(`✅ Ganaste. La palabra era ${state.word}. +4 puntos.${total === null ? "" : ` Total: ${total}`}`);
  } else if (state.lives <= 0) {
    hangman.delete(chatId);
    await ctx.reply(`❌ Perdiste. La palabra era ${state.word}.`);
  } else {
    await ctx.reply(`Palabra: ${visibleWord(state)}\nVidas: ${state.lives}\nLetras: ${[...state.letters].join(", ")}`);
  }
}

async function dailyMission(ctx: Context, arg: string) {
  const key = `${ctx.chat?.id}:${ctx.from?.id}`;
  const today = new Date().toISOString().slice(0, 10);
  let mission = dailyMissions.get(key);
  if (!mission || mission.date !== today) {
    mission = { date: today, text: missions[Math.abs(key.length + today.length) % missions.length], done: false };
    dailyMissions.set(key, mission);
  }
  if (normalize(arg) === "completar") {
    if (mission.done) await ctx.reply("📅 Esa misión ya estaba completada hoy.");
    else {
      mission.done = true;
      const total = await addScore(ctx.from, "mision", 3);
      await ctx.reply(`✅ Misión completada. +3 puntos.${total === null ? "" : ` Total: ${total}`}`);
    }
    return;
  }
  await ctx.reply(`📅 Misión de hoy:\n${mission.text}\nEstado: ${mission.done ? "completada" : "pendiente"}\nPara marcarla: /mision completar`);
}

async function pairCompetition(ctx: Context, arg: string) {
  const chatId = ctx.chat!.id;
  const action = normalize(arg);
  const comp = pairCompetitions.get(chatId);
  if (action === "estado") {
    await ctx.reply(scoreboard(comp));
    return;
  }
  if (action === "siguiente") {
    if (!comp) {
      await ctx.reply("No hay competencia activa. Usa /parejas iniciar Ana+Luis | Sofía+Carlos");
      return;
    }
    comp.index = (comp.index + 1) % comp.pairs.length;
    comp.current = random(pairQuestions);
    await ctx.reply(`👥 Turno de ${comp.pairs[comp.index].names}\n\n${comp.current.question}\nCorrecto +5, incorrecto -3.`);
    return;
  }
  if (action === "finalizar") {
    if (!comp) await ctx.reply("No hay competencia activa.");
    else {
      const winner = [...comp.pairs].sort((a, b) => b.points - a.points)[0];
      pairCompetitions.delete(chatId);
      await ctx.reply(`🏁 Competencia finalizada.\nGanadores: ${winner.names} con ${winner.points} puntos.`);
    }
    return;
  }
  if (!action.startsWith("iniciar")) {
    await ctx.reply("Uso: /parejas iniciar Ana+Luis | Sofía+Carlos");
    return;
  }
  const pairs = parseList(arg.replace(/^iniciar/i, "")).map((pair) => ({ names: pair.replace("+", " + "), points: 0 }));
  if (pairs.length < 2 || pairs.some((pair) => !pair.names.includes("+"))) {
    await ctx.reply("Necesito mínimo dos parejas en formato: /parejas iniciar Ana+Luis | Sofía+Carlos");
    return;
  }
  pairCompetitions.set(chatId, { pairs, index: -1 });
  await ctx.reply("🏆 Competencia creada. Usa /parejas siguiente.");
}

async function answerPairCompetition(ctx: Context, answer: string) {
  const comp = pairCompetitions.get(ctx.chat!.id)!;
  if (!comp.current) {
    await ctx.reply("Usa /parejas siguiente para lanzar una pregunta.");
    return;
  }
  const pair = comp.pairs[comp.index];
  const expected = comp.current.answer;
  comp.current = undefined;
  if (normalize(answer).includes(normalize(expected))) {
    pair.points += 5;
    await ctx.reply(`✅ Correcto. ${pair.names} suma 5.\n${scoreboard(comp)}`);
  } else {
    pair.points -= 3;
    await ctx.reply(`❌ Incorrecto. Respuesta: ${expected}. ${pair.names} pierde 3.\n${scoreboard(comp)}`);
  }
}

function scoreboard(comp?: PairCompetition) {
  if (!comp) return "No hay competencia activa.";
  return "📊 Marcador\n" + [...comp.pairs]
    .sort((a, b) => b.points - a.points)
    .map((p) => `- ${p.names}: ${p.points} pts`)
    .join("\n");
}

function visibleWord(state: HangmanState) {
  return state.word.split("").map((char) => state.letters.has(char) ? char : "_").join(" ");
}

function parseList(text: string) {
  return text.split(text.includes("|") ? "|" : ",").map((item) => item.trim()).filter(Boolean);
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function random<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function pick(items: string[]) {
  const index = Math.floor(Math.random() * items.length);
  return items.splice(index, 1)[0];
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
