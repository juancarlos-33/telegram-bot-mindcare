try { process.loadEnvFile?.(); } catch {}
import express from "express";
import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { 
  addScore, disconnectDb, saveCalendarEvent, saveGithubCheck, saveIntegration, 
  saveLog, saveYoutubeSearch, ensureUser, ensureGroup, addMoney, addKarma, 
  prisma, addXp, confirmVerification, saveComandoLog,
  updateChatInfo, getCustomResponse, recordCommandStat, isUserVerified,
  createPsyAppointment, getAllPsyAppointments, getPatientPsyAppointments, getPsyAppointmentsByDocument,
  cancelPsyAppointment, PSYCHOLOGY_SPECIALTIES, PSYCHOLOGY_THERAPISTS, getTherapistsBySpecialty,
  getBookingState, setBookingState, clearBookingState,
  saveMoodEntry, getUserMoodEntries, getAllMoodEntries,
  saveTestResult, getUserTestResults, getAllTestResults,
  getActiveTest, setActiveTest, clearActiveTest, GAD2_QUESTIONS, PHQ9_QUESTIONS, PSS4_QUESTIONS, PSYCHO_TIPS,
  getAllPatients, getPatientById, createPatient, getCRMMetrics, getAllPayments, recordPatientPayment,
  flagPatientRisk, hasPsyAppointmentConflict
} from "./db.js";
import { portalRouter } from "./portal.js";
import { gamesMenu, handleGameCommand, maybeHandleGameAnswer } from "./games.js";
import { askAI } from "./ai.js";
import { handleMarryCommand, handleDivorceCommand, getMarriages } from "./marriages.js";
import { handleStickerCommand, handleExtraerCommand } from "./media.js";
import { handleWarnCommand, handleBanCommand, handleAntiLinkCommand, handleAntiPornoCommand, handleBroadcastCommand } from "./admin.js";
import { handlePlayCommand, handleTiktokCommand, handleTtsCommand } from "./downloaders.js";
import { handleShopCommand, handleBuyCommand } from "./shop.js";
import { handleTopXpCommand, handleTopMoneyCommand } from "./leaderboards.js";
import { handleAfkCommand, checkAfkStatus } from "./afk.js";
import { handleVoiceNote } from "./voice.js";
import { checkSpam } from "./antispam.js";
import { handlePollCommand } from "./polls.js";
import { handleTranslateCommand } from "./translate.js";
import { handleSearchCommand } from "./search.js";
import { handleSnapCommand } from "./snap.js";
import { handleQrCommand } from "./qr.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME ?? "juancarlos_project_bot";
const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
  (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null) ||
  (process.env.NODE_ENV === "production" ? "https://telegram-bot-mindcare-production.up.railway.app" : `http://localhost:${process.env.PORT ?? 3000}`);
const PORT = Number(process.env.PORT ?? 3000);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const botToken = BOT_TOKEN || "0000000000:dummy_bot_token_placeholder";
const bot = new Telegraf(botToken);
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Trazabilidad de Usuarios, Grupos e Integrantes
bot.use(async (ctx, next) => {
  if (ctx.from) await ensureUser(ctx.from).catch(() => {});
  if (ctx.chat) {
    const type = ctx.chat.type;
    const title = (type === "private")
      ? (ctx.from ? `${ctx.from.first_name ?? ''} (@${ctx.from.username ?? 'sin_user'})` : "Chat Privado")
      : ("title" in ctx.chat ? ctx.chat.title : "Grupo Telegram");
    
    let memberCount = 1;
    if (type === "group" || type === "supergroup") {
      memberCount = await ctx.getChatMembersCount().catch(() => 1);
      await ensureGroup(ctx.chat as any).catch(() => {});
    }
    await updateChatInfo(String(ctx.chat.id), title ?? "Chat", type, memberCount, ctx.from?.username).catch(() => {});
  }
  return next();
});

// Montar portal web interactivo (Registro, Verificación, Autorización de Apps y Reportes)
app.use(portalRouter);

// Interceptor de Comandos (Estadísticas y Comandos Personalizados desde Web)
bot.use(async (ctx, next) => {
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  if (text?.startsWith("/")) {
    const parts = text.split(" ");
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");
    saveComandoLog(String(ctx.chat?.id ?? "0"), cmd, args, "exito").catch(() => {});
    recordCommandStat(cmd, ctx.from?.username ?? ctx.from?.first_name ?? "anónimo");

    // Revisar si es un comando personalizado agregado desde el Portal Web
    const customResponse = getCustomResponse(cmd);
    if (customResponse) {
      await ctx.reply(customResponse);
      return;
    }
  }
  return next();
});

async function handleStartFlow(ctx: Context) {
  try {
    const payload = getStartPayload(ctx);

    // Verificación de identidad desde el Portal Web
    if (payload?.startsWith("verify_") || payload?.startsWith("v_")) {
      const code = payload.startsWith("verify_") ? payload.replace("verify_", "") : payload;
      const res = await confirmVerification(code, String(ctx.from?.id ?? "0"), ctx.from?.username, ctx.from?.first_name).catch(() => ({ success: false }));
      if (res.success) {
        if (ctx.chat?.id) await saveLog(ctx.chat.id, "VERIFICACION", `Usuario @${ctx.from?.username ?? ctx.from?.first_name} verificado exitosamente`).catch(() => {});
        await ctx.reply([
          `🎉 ¡Identidad verificada exitosamente!`,
          "",
          `Hola ${ctx.from?.first_name ?? 'amigo/a'}, tu cuenta de Telegram (@${ctx.from?.username ?? 'sin_usuario'}) ha sido vinculada y activada en el sistema.`,
          "",
          "✨ A partir de ahora puedes interactuar conmigo libremente sin necesidad de volver a la página web.",
          "",
          "💡 Puedes probar ahora mismo:",
          "• !hola, ¿qué puedes hacer? (Para hablar con la IA de apoyo emocional)",
          "• /menu (Para ver todos los comandos)",
          "• /cita (Para agendar cita con especialista)",
          "",
          `Portal Web: ${APP_BASE_URL}/citas`
        ].join("\n"));
        return;
      }
    }

    if (payload?.startsWith("auth_")) {
      const provider = payload.replace("auth_", "");
      if (ctx.from) await saveIntegration(ctx.from, provider).catch(() => {});
      await ctx.reply(`✅ Permiso registrado para ${provider}.\nBD: users + integrations + logs.`);
      return;
    }

    if (ctx.from) await ensureUser(ctx.from).catch(() => {});
    if (ctx.chat?.id) await saveLog(ctx.chat.id, "start", `Usuario @${ctx.from?.username ?? ctx.from?.first_name} inició PsiBot MindCare`).catch(() => {});

    await ctx.reply([
      `🧠 ¡Hola, ${displayName(ctx)}! Bienvenido/a a MindCare — Centro Clínico de Psicología. 💙`,
      "",
      "Soy Dra. PsiBot, tu Asistente Clínica de Salud Mental y Bienestar.",
      "Estoy aquí para escucharte, orientarte y acompañarte en tu proceso emocional. 🌿",
      "",
      "✨ ¿QUÉ PODEMOS HACER HOY?",
      "• 📅 /cita — Agendar cita con especialista paso a paso",
      "• 📝 /test — Evaluación rápida de ansiedad (Escala GAD-2)",
      "• 💭 /diario — Registrar cómo te sientes hoy",
      "• 🌬️ /respirar — Ejercicio interactivo de relajación guiada",
      "• 🚨 /sos — Técnica para momentos de crisis o pánico",
      "• 💡 /tip — Consejo de salud mental basado en ciencia",
      "• 💬 !<mensaje> — Habla conmigo libremente sobre lo que sientes",
      "",
      `🌐 Portal Web Clínico: ${APP_BASE_URL}/citas`
    ].join("\n"), {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📅 Agendar Cita", callback_data: "book_start" }, { text: "📝 Test de Ansiedad", callback_data: "test_start" }],
          [{ text: "💭 ¿Cómo te sientes hoy?", callback_data: "mood_check" }, { text: "🌬️ Respirar", callback_data: "breath_guide" }],
          [{ text: "👥 Terapeutas", callback_data: "show_therapists" }, { text: "🆘 Auxilio Emocional", callback_data: "sos_guide" }]
        ]
      }
    });
  } catch (err) {
    console.error("Error en bot.start:", err);
    await ctx.reply("🧠 ¡Hola! Bienvenido a MindCare Psicología. Usa /menu o /cita para comenzar.");
  }
}

bot.start(handleStartFlow);
bot.command("start", handleStartFlow);

bot.command(["menu", "ayuda", "help"], async (ctx) => {
  await ctx.reply([
    "🧠 MENÚ DE HERRAMIENTAS • MINDCARE PSICOLOGÍA",
    "",
    "💬 APOYO EMOCIONAL Y TRIAGE CONVERSACIONAL:",
    "• !<mensaje> — Conversa libremente con Dra. PsiBot sobre cualquier emoción",
    "• 🎙️ Audio/Nota de voz — Envíale un audio y la IA lo transcribe y orienta",
    "• Ejemplo: !siento mucha presión por la universidad y no duermo bien",
    "",
    "🩺 HERRAMIENTAS CLÍNICAS Y PSICOMETRÍA:",
    "• /cita — Agendar cita paso a paso con botones interactivos",
    "• /consultar <documento> — Consultar fecha y hora de tu cita por documento",
    "• /miscitas — Ver tus citas agendadas y consultorio",
    "• /cancelarcita <ID> — Cancelar o liberar turno de cita",
    "• /terapeutas — Directorio de 6 especialistas de MindCare",
    "• /test — Batería de tamizaje (Ansiedad GAD-2 y Depresión PHQ-9)",
    "• /phq9 — Test clínico de tamizaje de depresión (Escala PHQ-9)",
    "• /burnout — Test de sobrecarga y agotamiento académico/laboral",
    "• /tcc — Técnica de reestructuración cognitiva (Modelo A-B-C-D-E)",
    "• /formula — Fórmula de prescripción conductual y autocuidado",
    "• /diario — Registro diario de tu estado de ánimo con emojis",
    "• /historial — Ver tu evolución emocional y puntuaciones",
    "• /respirar — Guía de respiración 4-7-8 para calmar la mente",
    "• /sos — Técnica sensorial 5-4-3-2-1 para pánico y sobrecarga",
    "• /tip — Cápsula de salud mental basada en neurociencia",
    "• /crisis — Directorio de líneas de emergencia 24/7 gratuitas",
    "",
    "💼 SISTEMA PROFESIONAL & EXPEDIENTES:",
    `• CRM & Historias SOAP: ${APP_BASE_URL}/crm`,
    `• Portal de Citas: ${APP_BASE_URL}/citas`,
    `• Certificados con QR: ${APP_BASE_URL}/paciente/HC-1001/certificado`
  ].join("\n"));
});

// =============================================================================
// FLUJO CONVERSACIONAL DE CITA PSI (Paso a paso con botones inline)
// =============================================================================
bot.command(["cita", "agendar", "pedircita"], async (ctx) => {
  const userId = String(ctx.from?.id ?? "0");
  clearBookingState(userId);
  setBookingState(userId, { step: "ask_name" });

  await ctx.reply(
    "💙 Perfecto, vamos a agendar tu cita de psicología.\n\nPrimero, ¿cuál es tu nombre completo o cómo prefieres que te llamemos?",
    { reply_markup: { force_reply: true } }
  );
});

// =============================================================================
// NUEVOS COMANDOS CLÍNICOS Y DE BIENESTAR
// =============================================================================

// 1. Test GAD-2
bot.command(["test", "ansiedad", "evaluacion"], async (ctx) => {
  const userId = String(ctx.from?.id ?? "0");
  setActiveTest(userId, { currentQuestion: 0, answers: [] });

  await ctx.reply([
    "📝 *TEST DE TAMIZAJE DE ANSIEDAD (GAD-2)*",
    "",
    "Este breve cuestionario clínico de 2 preguntas permite evaluar la presencia de síntomas ansiosos.",
    "",
    `*Pregunta 1 de 2:*`,
    GAD2_QUESTIONS[0]
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "0️⃣ Para nada / Ningún día", callback_data: "test_ans_0" }],
        [{ text: "1️⃣ Varios días", callback_data: "test_ans_1" }],
        [{ text: "2️⃣ Más de la mitad de los días", callback_data: "test_ans_2" }],
        [{ text: "3️⃣ Casi todos los días", callback_data: "test_ans_3" }]
      ]
    }
  });
});

// 2. Diario Emocional
bot.command(["diario", "animo", "emocion", "mood"], async (ctx) => {
  await ctx.reply([
    "💭 *CHEQUEO EMOCIONAL DIARIO — MINDCARE*",
    "",
    "Tómate un momento para conectar contigo:",
    "¿Cómo describirías tu estado de ánimo en este momento?"
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "😄 Excelente / Motivado/a", callback_data: "mood_excelente" }, { text: "😊 Bien / Tranquilo/a", callback_data: "mood_bien" }],
        [{ text: "😐 Neutral / Normal", callback_data: "mood_neutral" }, { text: "😟 Ansioso/a / Inquieto/a", callback_data: "mood_ansioso" }],
        [{ text: "😢 Triste / Desanimado/a", callback_data: "mood_triste" }, { text: "🥱 Agotado/a / Sin energía", callback_data: "mood_agotado" }]
      ]
    }
  });
});

// 3. Historial Emocional
bot.command(["historial", "mievolucion", "registros"], async (ctx) => {
  const userId = String(ctx.from?.id ?? "0");
  const moods = getUserMoodEntries(userId);
  const tests = getUserTestResults(userId);

  if (moods.length === 0 && tests.length === 0) {
    await ctx.reply([
      "📊 Aún no tienes registros emocionales.",
      "",
      "• Usa /diario para registrar cómo te sientes hoy.",
      "• Usa /test para realizar el cuestionario de ansiedad."
    ].join("\n"));
    return;
  }

  const moodLines = moods.slice(0, 5).map(m =>
    `• ${m.emoji} *${m.mood}* — ${m.createdAt.toLocaleDateString()} ${m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${m.note ? `\n  _${m.note}_` : ''}`
  ).join("\n");

  const testLines = tests.slice(0, 3).map(t =>
    `• 📝 *${t.testName}*: ${t.score}/${t.maxScore} pts (Nivel: ${t.severity}) — ${t.createdAt.toLocaleDateString()}`
  ).join("\n");

  await ctx.reply([
    "📊 *TU HISTORIAL DE BIENESTAR EMOCIONAL*",
    "",
    moodLines ? `💭 *Últimos Estados de Ánimo:*\n${moodLines}` : "",
    "",
    testLines ? `📝 *Evaluaciones Clínicas:*\n${testLines}` : "",
    "",
    "💡 Registrar tu día a día te ayuda a notar patrones y mejorar tu autoconocimiento."
  ].filter(Boolean).join("\n"), { parse_mode: "Markdown" });
});

// 4. Respiración Guiada
bot.command(["respirar", "calma", "relax"], async (ctx) => {
  await ctx.reply([
    "🌬️ *TÉCNICA DE RESPIRACIÓN 4-7-8 (DR. ANDREW WEIL)*",
    "",
    "Esta técnica activa el sistema nervioso parasimpático y calma la respuesta de lucha o huida.",
    "",
    "1️⃣ *Inhala* suavemente por la nariz contando mentalmente hasta *4*.",
    "2️⃣ *Retén* el aire cómodamente contando hasta *7*.",
    "3️⃣ *Exhala* lenta y completamente por la boca durante *8* segundos.",
    "",
    "Repite este ciclo 4 veces. Notarás cómo tu frecuencia cardíaca desciende y tu mente se aclara. 🌿"
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔄 Otra ronda de respiración", callback_data: "breath_guide" }],
        [{ text: "📅 Agendar cita con especialista", callback_data: "book_start" }]
      ]
    }
  });
});

// 5. SOS Pánico / Ansiedad
bot.command(["sos", "panico", "ansiedadfuerte"], async (ctx) => {
  await ctx.reply([
    "🚨 *AUXILIO EMOCIONAL: TÉCNICA 5-4-3-2-1 (ANCLAJE)* 🌿",
    "",
    "Si sientes que la ansiedad o el pánico te sobrepasan, haz este ejercicio en voz baja ahora mismo:",
    "",
    "👀 *5 cosas* que puedas VER a tu alrededor (ej: una ventana, una lámpara).",
    "✋ *4 cosas* que puedas TOCAR o sentir físicamente (tu ropa, la mesa).",
    "👂 *3 cosas* que puedas ESCUCHAR (el viento, un reloj, tu respiración).",
    "👃 *2 cosas* que puedas OLER (café, perfume, el aire).",
    "👅 *1 cosa* que puedas SABOREAR (un sorbo de agua, una menta).",
    "",
    "💙 Estás en un lugar seguro. Esta sensación es pasajera y pasará."
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌬️ Hacer respiración lenta", callback_data: "breath_guide" }],
        [{ text: "🆘 Ver líneas de crisis 24/7", callback_data: "crisis_info" }]
      ]
    }
  });
});

// 6. Tip psicológico
bot.command(["tip", "consejo", "mindfulness"], async (ctx) => {
  const tip = PSYCHO_TIPS[Math.floor(Math.random() * PSYCHO_TIPS.length)];
  await ctx.reply([
    `💡 *PÍLDORA DE SALUD MENTAL* ${tip.icon}`,
    "",
    `*${tip.title}*`,
    "",
    tip.content,
    "",
    "🌿 _MindCare — Cuidar de tu mente es prioridad._"
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎲 Ver otro consejo", callback_data: "tip_another" }]
      ]
    }
  });
});

// =============================================================================
// COMANDOS DEL CRM CLÍNICO Y GESTIÓN DE EXPEDIENTES
// =============================================================================

// 7. Comando /crm (Panel General del CRM)
bot.command(["crm", "pacientes", "embudo"], async (ctx) => {
  const metrics = getCRMMetrics();
  const patients = getAllPatients();
  const formatCOP = (num: number) => `$${num.toLocaleString('es-CO')} COP`;

  const patientList = patients.slice(0, 5).map(p =>
    `• \`${p.id}\` *${p.fullName}* (${p.pipelineStage.replace('_', ' ')})\n  👤 ${p.assignedTherapist} · ${p.totalSessions} sesiones`
  ).join("\n\n");

  await ctx.reply([
    "💼 *MINDCARE CRM PRO — DASHBOARD CLÍNICO*",
    "",
    `👥 *Pacientes en Base:* ${metrics.totalPatients}`,
    `🟢 *En Tratamiento Activo:* ${metrics.activePatients} (${metrics.retentionRate}% retención)`,
    `🎯 *Nuevos Leads / Triaje:* ${metrics.newLeads}`,
    `📅 *Primeras Citas:* ${metrics.firstAppointments}`,
    `🎓 *Altas Terapéuticas:* ${metrics.discharges}`,
    `🗓️ *Sesiones Atendidas:* ${metrics.totalSessions}`,
    `💰 *Ingresos Recaudados:* ${formatCOP(metrics.totalRevenue)}`,
    `⌛ *Pendiente por Cobrar:* ${formatCOP(metrics.pendingRevenue)}`,
    "",
    "📁 *Expedientes Recientes:*",
    patientList,
    "",
    "💡 *Comandos del CRM:*",
    "• `/historia <ID_PACIENTE>` — Ver historia clínica SOAP",
    "• `/pagos` — Resumen de facturación de consultas",
    "",
    `🌐 *Portal Web CRM:* ${APP_BASE_URL}/crm`
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💼 Abrir Portal CRM Web", url: `${APP_BASE_URL}/crm` }],
        [{ text: "💳 Ver Libro de Pagos", callback_data: "crm_view_payments" }]
      ]
    }
  });
});

// 8. Comando /historia o /paciente (Historia Clínica Digital SOAP)
bot.command(["historia", "expediente", "paciente"], async (ctx) => {
  const query = commandArg(ctx).trim();
  if (!query) {
    await ctx.reply([
      "📁 *CONSULTA DE HISTORIA CLÍNICA DIGITAL*",
      "",
      "Uso: `/historia <ID o Nombre>`",
      "Ejemplos:",
      "• `/historia HC-1001`",
      "• `/historia Juan Carlos`",
      "• `/historia HC-1002`"
    ].join("\n"), { parse_mode: "Markdown" });
    return;
  }

  const patient = getPatientById(query);
  if (!patient) {
    await ctx.reply(`❌ No se encontró ningún expediente clínico con el identificador "${query}".`);
    return;
  }

  const lastNote = patient.notesHistory[0];

  const noteBlock = lastNote ? [
    `📝 *ÚLTIMA NOTA DE EVOLUCIÓN (Sesión ${lastNote.sessionNumber} · ${lastNote.date}):*`,
    `• *[S] Subjetivo:* ${lastNote.subjective}`,
    `• *[O] Objetivo:* ${lastNote.objective}`,
    `• *[A] Análisis:* ${lastNote.analysis}`,
    `• *[P] Plan:* ${lastNote.plan}`
  ].join("\n") : "📝 *Notas de Sesión:* Sin notas clínicas registradas aún.";

  await ctx.reply([
    `📁 *EXPEDIENTE CLÍNICO DIGITAL — ${patient.id}*`,
    "",
    `👤 *Paciente:* ${patient.fullName}`,
    `📄 *Documento:* ${patient.document} · *Edad:* ${patient.age} años`,
    `📞 *Contacto:* ${patient.phone}`,
    `🏷️ *Etapa CRM:* ${patient.pipelineStage.replace('_', ' ')}`,
    `🩺 *Diagnóstico Hipótesis:* ${patient.diagnosticHypothesis}`,
    `👨‍⚕️ *Terapeuta Asignado:* ${patient.assignedTherapist} (${patient.specialty})`,
    `🔢 *Sesiones Realizadas:* ${patient.totalSessions}`,
    `🏷️ *Tags:* ${patient.tags.join(', ')}`,
    "",
    noteBlock,
    "",
    `🌐 *Ver expediente completo en CRM:* ${APP_BASE_URL}/crm`
  ].join("\n"), { parse_mode: "Markdown" });
});

// 9. Comando /pagos (Libro de Facturación y Honorarios)
bot.command(["pagos", "facturacion", "honorarios"], async (ctx) => {
  const payments = getAllPayments();
  const metrics = getCRMMetrics();
  const formatCOP = (num: number) => `$${num.toLocaleString('es-CO')} COP`;

  const payLines = payments.slice(0, 5).map(p =>
    `• *${p.patientName}* — ${formatCOP(p.amount)}\n  _${p.concept}_ · ${p.method} [${p.status}]`
  ).join("\n\n");

  await ctx.reply([
    "💳 *LIBRO DE FACTURACIÓN Y PAGOS — MINDCARE*",
    "",
    `💰 *Recaudado:* ${formatCOP(metrics.totalRevenue)}`,
    `⌛ *Pendiente:* ${formatCOP(metrics.pendingRevenue)}`,
    "",
    "📋 *Últimos Registros Contables:*",
    payLines || "Sin registros contables.",
    "",
    `🌐 *Administrar facturas en web:* ${APP_BASE_URL}/crm`
  ].join("\n"), { parse_mode: "Markdown" });
});

// 10. Comando /certificado (Emisión de Certificado Oficial con QR y PDF)
bot.command(["certificado", "constancia"], async (ctx) => {
  const query = commandArg(ctx).trim() || "HC-1001";
  const patient = getPatientById(query) || getAllPatients()[0];

  if (!patient) {
    await ctx.reply("❌ No se encontró ningún expediente clínico registrado.");
    return;
  }

  const certUrl = `${APP_BASE_URL}/paciente/${patient.id}/certificado`;

  await ctx.reply([
    "📜 *CERTIFICADO CLÍNICO OFICIAL EMITIDO* 🧠",
    "",
    `Folio Digital: \`${patient.id}\``,
    `Paciente: *${patient.fullName}* (CC: ${patient.document})`,
    `Terapeuta Responsable: *${patient.assignedTherapist}*`,
    `Especialidad: ${patient.specialty}`,
    `Estado en Tratamiento: ${patient.pipelineStage.replace('_', ' ')}`,
    `Sesiones Acreditadas: ${patient.totalSessions}`,
    "",
    "✅ *Incluye:* Sello institucional, firma digital del terapeuta y código QR de verificación de autenticidad en tiempo real.",
    "",
    `🔗 *Ver e Imprimir Certificado en PDF:*`,
    certUrl
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📄 Abrir / Descargar Certificado PDF", url: certUrl }]
      ]
    }
  });
});

// 11. Comando /formula o /receta (Prescripción Psicoterapéutica Conductual)
bot.command(["formula", "receta", "prescripcion"], async (ctx) => {
  const patientName = displayName(ctx);
  await ctx.reply([
    "📋 *RECETA MÉDICA CONDUCTUAL — MINDCARE*",
    "══════════════════════════════",
    `👤 *Paciente:* ${patientName}`,
    `📅 *Fecha de Emisión:* ${new Date().toLocaleDateString('es-CO')}`,
    `👨‍⚕️ *Emite:* Dra. Valentina Ríos (Psicología Clínica Adultos)`,
    "══════════════════════════════",
    "",
    "💊 *PSICOHIGIENE CONDUCTUAL PRESCRITA:*",
    "",
    "1️⃣ *Caminata Consciente (20 min/día):* Sin auriculares ni teléfono. Observa el entorno para regular los niveles de cortisol.",
    "",
    "2️⃣ *Respiración Diafragmática 4-7-8:* 4 ciclos al despertar y 4 ciclos antes de dormir para inducir el reposo parasimpático.",
    "",
    "3️⃣ *Diario de Tres Agradecimientos:* Escribe cada noche 3 cosas concretas que salieron bien en tu día (reeducación del sesgo negativo).",
    "",
    "4️⃣ *Apagón Digital:* Desconexión de pantallas 45 minutos antes de dormir para proteger la secreción de melatonina.",
    "",
    "══════════════════════════════",
    "✍️ *Firma Digital:* Dra. Valentina Ríos — T.P. 188.420 Colpsic",
    "🌿 _MindCare: Salud mental con rigor científico._"
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌬️ Iniciar Ejercicio de Respiración", callback_data: "breath_guide" }],
        [{ text: "💭 Registrar en Mi Diario", callback_data: "mood_check" }]
      ]
    }
  });
});

// 12. Comando /burnout (Test de Agotamiento Académico / Laboral)
bot.command(["burnout", "estreslaboral", "agotamiento"], async (ctx) => {
  await ctx.reply([
    "🔥 *TEST DE BURNOUT ACADÉMICO / LABORAL (ESCALA BREVE)*",
    "",
    "Evalúa tu nivel actual de sobrecarga y desgaste en el estudio o trabajo.",
    "",
    "1️⃣ *¿Sientes agotamiento físico o mental al pensar en tus responsabilidades?*",
    "2️⃣ *¿Notas distanciamiento, cinismo o pérdida de interés en lo que haces?*",
    "3️⃣ *¿Sientes que tu rendimiento ha bajado a pesar del esfuerzo?*",
    "",
    "¿Cómo describirías tu situación actual?"
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🟢 Nivel Bajo (Manejable)", callback_data: "burnout_low" }],
        [{ text: "🟡 Nivel Moderado (Fatiga frecuente)", callback_data: "burnout_med" }],
        [{ text: "🔴 Nivel Severo (Agotamiento total)", callback_data: "burnout_high" }]
      ]
    }
  });
});

// 13. Comando /phq9 (Test de Depresión PHQ-9)
bot.command(["phq9", "depresion", "animo_test"], async (ctx) => {
  const userId = String(ctx.from?.id ?? "0");
  setActiveTest(userId, { testType: "PHQ9", currentQuestion: 0, answers: [] });
  await ctx.reply([
    "📋 *TEST PHQ-9 DE ESTADO DE ÁNIMO Y DEPRESIÓN*",
    "Durante las últimas 2 semanas, ¿con qué frecuencia te han molestado los siguientes síntomas?",
    "",
    `*Pregunta 1 de 9:*`,
    PHQ9_QUESTIONS[0]
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "0️⃣ Ningún día", callback_data: "test_ans_0" }],
        [{ text: "1️⃣ Varios días", callback_data: "test_ans_1" }],
        [{ text: "2️⃣ Más de la mitad de los días", callback_data: "test_ans_2" }],
        [{ text: "3️⃣ Casi todos los días", callback_data: "test_ans_3" }]
      ]
    }
  });
});

// 14. Comando /tcc (Reestructuración Cognitiva TCC)
bot.command(["tcc", "pensamiento", "reestructuracion"], async (ctx) => {
  await ctx.reply([
    "🧠 *TÉCNICA DE REESTRUCTURACIÓN COGNITIVA (TCC / BECK & ELLIS)*",
    "",
    "Nuestros pensamientos no siempre son hechos objetivos. Cuando sientas una emoción abrumadora, aplica el modelo *A-B-C-D-E*:",
    "",
    "📍 *[A] Acontecimiento:* ¿Qué situación específica ocurrió?",
    "💭 *[B] Pensamiento Automático:* ¿Qué te dijiste a ti mismo/a? (Ej: 'Si me equivoco, todo se arruina')",
    "⚡ *[C] Consecuencia Emocional:* ¿Qué sentiste en el cuerpo? (Angustia, taquicardia, culpa)",
    "⚖️ *[D] Debate Socrático:* ¿Qué evidencia real tienes a favor y en contra de esa idea?",
    "🌿 *[E] Pensamiento Alternativo:* Una perspectiva más justa y balanceada (Ej: 'Es un reto difícil, pero puedo resolverlo paso a paso')",
    "",
    "💡 *Distorsiones cognitivas frecuentes:*",
    "• *Catastrofismo:* Imaginar siempre la peor catástrofe posible.",
    "• *Pensamiento Todo o Nada:* Ver la vida en blanco o negro sin matices.",
    "• *Lectura de Mente:* Suponer lo que otros piensan negativamente de ti.",
    "",
    "¿Quieres poner en debate un pensamiento que te angustia? Escríbeme: !<tu pensamiento>"
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌬️ Respiración Calmante", callback_data: "breath_guide" }],
        [{ text: "📅 Agendar Sesión de TCC", callback_data: "book_start" }]
      ]
    }
  });
});



// =============================================================================
// MANEJADOR DE CALLBACK QUERIES (BOTONES INTERACTIVOS)
// =============================================================================
bot.on("callback_query", async (ctx) => {
  const data = (ctx.callbackQuery as any).data as string;
  const userId = String(ctx.from?.id ?? "0");
  await ctx.answerCbQuery();

  if (data === "book_start") {
    clearBookingState(userId);
    setBookingState(userId, { step: "ask_name" });
    await ctx.reply("💙 Vamos a agendar tu cita.\n\n¿Cuál es tu nombre completo?", { reply_markup: { force_reply: true } });
    return;
  }

  if (data === "show_therapists") {
    const lines = PSYCHOLOGY_SPECIALTIES.map(s =>
      `${s.icon} *${s.name}*\n  👤 ${s.therapist} · ${s.office}\n  🕐 Espera: ${s.waitTime}\n  📌 ${s.description}`
    ).join("\n\n");
    await ctx.reply(`🧠 *NUESTROS ESPECIALISTAS — MINDCARE*\n\n${lines}`, { parse_mode: "Markdown" });
    return;
  }

  if (data === "crisis_info") {
    await ctx.reply([
      "🆘 LÍNEAS DE APOYO EN CRISIS 🆘",
      "",
      "🇨🇴 Colombia — Línea 106 (gratuita 24/7)",
      "🌍 Internacional — findahelpline.com",
      "",
      "Si estás en peligro inmediato, llama al 123.",
      "",
      "💙 No estás solo/a. Estoy aquí para escucharte.",
      "Escríbeme: !<cómo te sientes>"
    ].join("\n"));
    return;
  }

  if (data === "test_start") {
    await ctx.reply([
      "📝 *BATERÍA DE TAMIZAJE PSICOMÉTRICO — MINDCARE*",
      "",
      "Selecciona la evaluación clínica que deseas realizar hoy:",
      "",
      "1️⃣ *Escala GAD-2 (Ansiedad):* 2 preguntas rápidas sobre tensión y preocupación.",
      "2️⃣ *Cuestionario PHQ-9 (Depresión):* 9 preguntas estándar sobre estado de ánimo y energía.",
      "3️⃣ *Escala PSS-4 (Estrés Percibido):* 4 preguntas sobre sobrecarga y control emocional."
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⚡ Test GAD-2 (Ansiedad - 2 min)", callback_data: "start_gad2" }],
          [{ text: "📋 Test PHQ-9 (Depresión - 4 min)", callback_data: "start_phq9" }],
          [{ text: "🔥 Test PSS-4 (Estrés Percibido - 2 min)", callback_data: "start_pss4" }]
        ]
      }
    });
    return;
  }

  if (data === "start_gad2") {
    setActiveTest(userId, { testType: "GAD2", currentQuestion: 0, answers: [] });
    await ctx.reply([
      "📝 *TEST GAD-2 DE ANSIEDAD*",
      "En las últimas 2 semanas, ¿con qué frecuencia has tenido el siguiente problema?",
      "",
      `*Pregunta 1 de 2:*`,
      GAD2_QUESTIONS[0]
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "0️⃣ Ningún día", callback_data: "test_ans_0" }],
          [{ text: "1️⃣ Varios días", callback_data: "test_ans_1" }],
          [{ text: "2️⃣ Más de la mitad de los días", callback_data: "test_ans_2" }],
          [{ text: "3️⃣ Casi todos los días", callback_data: "test_ans_3" }]
        ]
      }
    });
    return;
  }

  if (data === "start_phq9") {
    setActiveTest(userId, { testType: "PHQ9", currentQuestion: 0, answers: [] });
    await ctx.reply([
      "📋 *TEST PHQ-9 DE ESTADO DE ÁNIMO Y DEPRESIÓN*",
      "Durante las últimas 2 semanas, ¿con qué frecuencia te han molestado los siguientes síntomas?",
      "",
      `*Pregunta 1 de 9:*`,
      PHQ9_QUESTIONS[0]
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "0️⃣ Ningún día", callback_data: "test_ans_0" }],
          [{ text: "1️⃣ Varios días", callback_data: "test_ans_1" }],
          [{ text: "2️⃣ Más de la mitad de los días", callback_data: "test_ans_2" }],
          [{ text: "3️⃣ Casi todos los días", callback_data: "test_ans_3" }]
        ]
      }
    });
    return;
  }

  if (data === "start_pss4") {
    setActiveTest(userId, { testType: "PSS4", currentQuestion: 0, answers: [] });
    await ctx.reply([
      "🔥 *TEST PSS-4 DE ESTRÉS PERCIBIDO*",
      "Durante el último mes, responde con qué frecuencia has experimentado lo siguiente:",
      "",
      `*Pregunta 1 de 4:*`,
      PSS4_QUESTIONS[0]
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "0️⃣ Nunca", callback_data: "test_ans_0" }],
          [{ text: "1️⃣ Casi nunca", callback_data: "test_ans_1" }],
          [{ text: "2️⃣ A veces", callback_data: "test_ans_2" }],
          [{ text: "3️⃣ Muy a menudo", callback_data: "test_ans_3" }]
        ]
      }
    });
    return;
  }

  // Respuestas dinámicas de Tests (GAD-2 y PHQ-9)
  if (data.startsWith("test_ans_")) {
    const val = Number(data.replace("test_ans_", ""));
    const active = getActiveTest(userId) ?? { testType: "GAD2", currentQuestion: 0, answers: [] };
    active.answers.push(val);

    // Flujo PHQ-9
    if (active.testType === "PHQ9") {
      if (active.currentQuestion < PHQ9_QUESTIONS.length - 1) {
        active.currentQuestion += 1;
        setActiveTest(userId, active);
        await ctx.reply([
          `*Pregunta ${active.currentQuestion + 1} de 9:*`,
          PHQ9_QUESTIONS[active.currentQuestion]
        ].join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "0️⃣ Ningún día", callback_data: "test_ans_0" }],
              [{ text: "1️⃣ Varios días", callback_data: "test_ans_1" }],
              [{ text: "2️⃣ Más de la mitad de los días", callback_data: "test_ans_2" }],
              [{ text: "3️⃣ Casi todos los días", callback_data: "test_ans_3" }]
            ]
          }
        });
        return;
      }

      // Evaluación final PHQ-9
      const totalScore = active.answers.reduce((acc, curr) => acc + curr, 0);
      const suicideThoughtAnswer = active.answers[8] ?? 0;
      clearActiveTest(userId);

      let severity: "Mínimo / Normal" | "Leve" | "Moderado" | "Significativo" = "Mínimo / Normal";
      let interpretation = "";

      if (totalScore <= 4) {
        severity = "Mínimo / Normal";
        interpretation = "Puntaje en rango mínimo/habitual. Estado de ánimo general dentro de parámetros estables.";
      } else if (totalScore <= 9) {
        severity = "Leve";
        interpretation = "Síntomas depresivos leves. Recomendamos activar hábitos de autocuidado, paseos al aire libre y monitoreo diario con /diario.";
      } else if (totalScore <= 14) {
        severity = "Moderado";
        interpretation = "Sintomatología depresiva moderada. Sería oportuno consultar con un psicólogo clínico para diseñar un plan de activación conductual.";
      } else {
        severity = "Significativo";
        interpretation = "Sintomatología depresiva significativa o severa. Te recomendamos fuertemente agendar una sesión clínica de valoración para recibir acompañamiento profesional.";
      }

      // Alerta de seguridad si la pregunta 9 (ideación de daño) es positiva
      if (suicideThoughtAnswer > 0) {
        flagPatientRisk(displayName(ctx), "Alerta PHQ-9 Ítem 9 positivo");
        await saveLog(ctx.chat!.id, "ALERTA_PHQ9", `Usuario ${displayName(ctx)} reportó puntuación > 0 en ítem 9 de PHQ-9`);
      }

      saveTestResult(userId, displayName(ctx), "Cuestionario PHQ-9", totalScore, 27, severity, interpretation);
      await saveLog(ctx.chat!.id, "TEST_PSI", `Usuario ${displayName(ctx)} completó PHQ-9: ${totalScore}/27 (${severity})`);

      await ctx.reply([
        "📊 *RESULTADO DEL CUESTIONARIO PHQ-9*",
        "",
        `🎯 *Puntaje Total:* ${totalScore} / 27 puntos`,
        `🏷️ *Nivel:* ${severity}`,
        "",
        `📋 *Interpretación Orientativa:*`,
        interpretation,
        suicideThoughtAnswer > 0
          ? "\n⚠️ *Nota de Acompañamiento:* Notamos que marcaste dificultades con respecto al valor de la vida. Por favor recuerda que no estás solo/a y que en Colombia la Línea 106 está abierta 24/7 de forma gratuita."
          : "",
        "",
        "⚠️ _Este test es orientativo y no reemplaza una consulta clínica profesional._"
      ].filter(Boolean).join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📅 Agendar Cita con Especialista", callback_data: "book_start" }],
            [{ text: "📊 Ver Mi Historial", callback_data: "view_history" }]
          ]
        }
      });
      return;
    }

    // Flujo PSS-4 (Estrés Percibido)
    if (active.testType === "PSS4") {
      if (active.currentQuestion < PSS4_QUESTIONS.length - 1) {
        active.currentQuestion += 1;
        setActiveTest(userId, active);
        await ctx.reply([
          `*Pregunta ${active.currentQuestion + 1} de 4:*`,
          PSS4_QUESTIONS[active.currentQuestion]
        ].join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "0️⃣ Nunca", callback_data: "test_ans_0" }],
              [{ text: "1️⃣ Casi nunca", callback_data: "test_ans_1" }],
              [{ text: "2️⃣ A veces", callback_data: "test_ans_2" }],
              [{ text: "3️⃣ Muy a menudo", callback_data: "test_ans_3" }]
            ]
          }
        });
        return;
      }

      // Evaluación final PSS-4
      const totalScore = active.answers.reduce((acc, curr) => acc + curr, 0);
      clearActiveTest(userId);

      let severity: "Mínimo / Normal" | "Leve" | "Moderado" | "Significativo" = "Mínimo / Normal";
      let interpretation = "";

      if (totalScore <= 3) {
        severity = "Mínimo / Normal";
        interpretation = "Nivel de estrés percibido bajo. Posees buenos recursos de afrontamiento y sensación de control sobre tus tareas.";
      } else if (totalScore <= 6) {
        severity = "Leve";
        interpretation = "Nivel de estrés leve o situacional. Recomendable incorporar pausas de respiración y descanso activo.";
      } else if (totalScore <= 9) {
        severity = "Moderado";
        interpretation = "Nivel de estrés moderado con sensación recurrente de sobrecarga. Te sugerimos estructurar tus prioridades y probar /respirar.";
      } else {
        severity = "Significativo";
        interpretation = "Estrés percibido elevado / sobrecarga crónica. Tus recursos de afrontamiento se encuentran al límite; te sugerimos agendar una sesión de apoyo psicológico.";
      }

      saveTestResult(userId, displayName(ctx), "Escala PSS-4", totalScore, 12, severity, interpretation);
      await saveLog(ctx.chat!.id, "TEST_PSI", `Usuario ${displayName(ctx)} completó PSS-4: ${totalScore}/12 (${severity})`);

      await ctx.reply([
        "📊 *RESULTADO DE LA ESCALA PSS-4 (ESTRÉS PERCIBIDO)*",
        "",
        `🎯 *Puntaje Total:* ${totalScore} / 12 puntos`,
        `🏷️ *Nivel:* ${severity}`,
        "",
        `📋 *Interpretación Clínica:*`,
        interpretation,
        "",
        "💡 Puedes revisar tu fórmula conductual con /formula o agendar apoyo con /cita."
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            totalScore >= 7
              ? [{ text: "📅 Agendar Cita de Manejo de Estrés", callback_data: "book_start" }]
              : [{ text: "🌬️ Respiración 4-7-8", callback_data: "breath_guide" }],
            [{ text: "📊 Ver Mi Historial", callback_data: "view_history" }]
          ]
        }
      });
      return;
    }

    // Flujo GAD-2 (Ansiedad)
    if (active.currentQuestion === 0) {
      active.currentQuestion = 1;
      setActiveTest(userId, active);
      await ctx.reply([
        `*Pregunta 2 de 2:*`,
        GAD2_QUESTIONS[1]
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "0️⃣ Ningún día", callback_data: "test_ans_0" }],
            [{ text: "1️⃣ Varios días", callback_data: "test_ans_1" }],
            [{ text: "2️⃣ Más de la mitad de los días", callback_data: "test_ans_2" }],
            [{ text: "3️⃣ Casi todos los días", callback_data: "test_ans_3" }]
          ]
        }
      });
      return;
    }

    // Calcular resultado final GAD-2
    const totalScore = active.answers.reduce((acc, curr) => acc + curr, 0);
    clearActiveTest(userId);

    let severity: "Mínimo / Normal" | "Leve" | "Moderado" | "Significativo" = "Mínimo / Normal";
    let recommendation = "";

    if (totalScore <= 1) {
      severity = "Mínimo / Normal";
      recommendation = "Tus niveles de ansiedad se encuentran dentro del rango habitual. Continúa cuidando tus hábitos de sueño y descanso.";
    } else if (totalScore <= 3) {
      severity = "Leve";
      recommendation = "Presentas ciertos síntomas de ansiedad leve. Te recomendamos ejercicios de respiración, pausas activas y registrar tu diario con /diario.";
    } else if (totalScore === 4) {
      severity = "Moderado";
      recommendation = "Tus síntomas sugieren un nivel moderado de ansiedad que podría beneficiarse de orientación psicológica preventiva.";
    } else {
      severity = "Significativo";
      recommendation = "Tu puntaje indica un impacto considerable en tu bienestar. Te sugerimos agendar una sesión de valoración con uno de nuestros psicólogos.";
    }

    saveTestResult(userId, displayName(ctx), "Escala GAD-2", totalScore, 6, severity, recommendation);
    await saveLog(ctx.chat!.id, "TEST_PSI", `Usuario ${displayName(ctx)} completó Test GAD-2: ${totalScore}/6 (${severity})`);

    await ctx.reply([
      "📊 *RESULTADO DEL TEST GAD-2 (ANSIEDAD)*",
      "",
      `🎯 *Puntaje Total:* ${totalScore} / 6 puntos`,
      `🏷️ *Nivel:* ${severity}`,
      "",
      `📋 *Interpretación Clínica Orientativa:*`,
      recommendation,
      "",
      "⚠️ _Nota: Este cuestionario es un tamizaje digital orientativo y no reemplaza un diagnóstico clínico profesional._"
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          totalScore >= 3
            ? [{ text: "📅 Agendar Cita con Psicólogo/a", callback_data: "book_start" }]
            : [{ text: "🌬️ Ejercicio de Respiración", callback_data: "breath_guide" }],
          [{ text: "📊 Ver Mi Historial", callback_data: "view_history" }]
        ]
      }
    });
    return;
  }

  // Respuestas de Estado de Ánimo
  if (data.startsWith("mood_")) {
    const moodKey = data.replace("mood_", "");
    const moodMap: Record<string, { label: string; emoji: string; reply: string }> = {
      excelente: { label: "Excelente", emoji: "😄", reply: "¡Qué alegría saber que estás con buena energía! Aprovecha para compartir esa vibra y avanzar en tus metas. ✨" },
      bien: { label: "Tranquilo/a", emoji: "😊", reply: "Estar en calma y en equilibrio es un gran estado. Mantén ese ritmo sereno hoy. 🌿" },
      neutral: { label: "Neutral", emoji: "😐", reply: "Los días normales también son valiosos. Es completamente válido tener momentos neutros. 💙" },
      ansioso: { label: "Ansioso/a", emoji: "😟", reply: "Lamento que sientas ansiedad. Recuerda que no estás solo/a. Puedes probar la respiración con /respirar o contarme qué te preocupa con !<mensaje>." },
      triste: { label: "Triste", emoji: "😢", reply: "Abrazo lo que sientes. La tristeza es una emoción natural que nos pide frenar y escucharnos. Aquí estoy si quieres desahogarte." },
      agotado: { label: "Agotado/a", emoji: "🥱", reply: "El cansancio mental es real. Si puedes, date una pausa, toma agua y regálate unos minutos de desconexión." }
    };

    const entry = moodMap[moodKey] ?? { label: "Registrado", emoji: "💭", reply: "Gracias por registrar cómo te sientes." };
    saveMoodEntry(userId, displayName(ctx), entry.label, entry.emoji);
    await saveLog(ctx.chat!.id, "MOOD_CHECK", `Usuario ${displayName(ctx)} registró ánimo: ${entry.emoji} ${entry.label}`);

    await ctx.reply([
      `💭 *Registro guardado:* ${entry.emoji} *${entry.label}*`,
      "",
      entry.reply,
      "",
      "Puedes revisar tus registros pasados con /historial."
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          moodKey === "ansioso" || moodKey === "triste" || moodKey === "agotado"
            ? [{ text: "🌬️ Respiración Guiada", callback_data: "breath_guide" }, { text: "📅 Agendar Cita", callback_data: "book_start" }]
            : [{ text: "💡 Ver un Consejo del Día", callback_data: "tip_another" }]
        ]
      }
    });
    return;
  }

  if (data === "breath_guide") {
    await ctx.reply([
      "🌬️ *RESPIRACIÓN 4-7-8*",
      "",
      "1. Inhala por la nariz (4s)...",
      "2. Retén el aire (7s)...",
      "3. Exhala por la boca (8s)...",
      "",
      "Hazlo a tu ritmo durante 1 o 2 minutos. Sentirás cómo baja la tensión muscular. 🌿"
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💭 Registrar cómo me siento", callback_data: "mood_check" }]
        ]
      }
    });
    return;
  }

  if (data === "sos_guide") {
    await ctx.reply([
      "🚨 *EJERCICIO DE ANCLAJE 5-4-3-2-1*",
      "",
      "Nombra ahora mismo:",
      "• 5 cosas que ves",
      "• 4 cosas que tocas",
      "• 3 cosas que escuchas",
      "• 2 cosas que hueles",
      "• 1 cosa que saboreas",
      "",
      "💙 Tu cuerpo está a salvo en este momento."
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🆘 Líneas de Emergencia", callback_data: "crisis_info" }]
        ]
      }
    });
    return;
  }

  if (data === "tip_another") {
    const tip = PSYCHO_TIPS[Math.floor(Math.random() * PSYCHO_TIPS.length)];
    await ctx.reply([
      `💡 *CONSEJO DE SALUD MENTAL* ${tip.icon}`,
      "",
      `*${tip.title}*`,
      "",
      tip.content
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎲 Otro consejo", callback_data: "tip_another" }]
        ]
      }
    });
    return;
  }

  if (data === "view_history") {
    const moods = getUserMoodEntries(userId);
    const tests = getUserTestResults(userId);
    const moodLines = moods.slice(0, 3).map(m => `• ${m.emoji} ${m.mood} (${m.createdAt.toLocaleDateString()})`).join("\n");
    const testLines = tests.slice(0, 2).map(t => `• 📝 ${t.testName}: ${t.score}/${t.maxScore} (${t.severity})`).join("\n");

    await ctx.reply([
      "📊 *RESUMEN RÁPIDO DE TU HISTORIAL:*",
      "",
      moodLines ? `*Ánimo reciente:*\n${moodLines}` : "Sin registros de ánimo.",
      "",
      testLines ? `*Tests recientes:*\n${testLines}` : "Sin tests completados."
    ].join("\n"), { parse_mode: "Markdown" });
    return;
  }

  if (data === "mood_check") {
    await ctx.reply([
      "💭 *¿CÓMO ESTÁ TU ÁNIMO HOY?*",
      "Selecciona la opción que mejor te describa:"
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "😄 Excelente", callback_data: "mood_excelente" }, { text: "😊 Bien / Calma", callback_data: "mood_bien" }],
          [{ text: "😐 Neutral", callback_data: "mood_neutral" }, { text: "😟 Ansioso/a", callback_data: "mood_ansioso" }],
          [{ text: "😢 Triste", callback_data: "mood_triste" }, { text: "🥱 Agotado/a", callback_data: "mood_agotado" }]
        ]
      }
    });
    return;
  }

  // Selección de especialidad desde botones -> Paso a Selección de Terapeuta
  if (data.startsWith("spec_")) {
    const specId = data.replace("spec_", "");
    const spec = PSYCHOLOGY_SPECIALTIES.find(s => s.id === specId);
    if (!spec) return;

    const state = getBookingState(userId);
    setBookingState(userId, { ...state, step: "ask_therapist", specialty: spec.name });

    const therapistButtons = getTherapistsBySpecialty(spec.name).map(t => ([{
      text: `${t.icon} ${t.name} (${t.specialty})`, callback_data: `therapist_${t.id}`
    }]));
    therapistButtons.push([
      { text: "⬅️ Cambiar Especialidad", callback_data: "nav_back_specialty" },
      { text: "❌ Cancelar", callback_data: "cancel_booking" }
    ]);

    await ctx.reply(
      `✅ Excelente, elegiste *${spec.icon} ${spec.name}*.\n\n👨‍⚕️ *¿Con qué profesional prefieres atenderte?*\nSelecciona a tu terapeuta:`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: therapistButtons } }
    );
    return;
  }

  // Selección de Terapeuta desde botones -> Paso a Fecha y Horario
  if (data.startsWith("therapist_")) {
    const state = getBookingState(userId);
    const therapistId = data.replace("therapist_", "");
    const th = getTherapistsBySpecialty(state.specialty ?? "").find(t => t.id === therapistId);
    if (!th) {
      await ctx.reply("⚠️ Ese profesional no corresponde a la especialidad seleccionada. Elige una opción de la lista.");
      return;
    }
    setBookingState(userId, { ...state, step: "ask_date", therapist: th.name });

    await ctx.reply(
      `👨‍⚕️ Terapeuta seleccionado: *${th.name}* (${th.specialty} • ${th.office}).\n\n📅 ¿Qué día y horario prefieres para tu consulta?\n\n_Ejemplo: Mañana a las 10 AM / Viernes a las 3 PM_`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Cambiar Terapeuta", callback_data: "nav_back_therapist" },
              { text: "❌ Cancelar", callback_data: "cancel_booking" }
            ]
          ]
        }
      }
    );
    return;
  }

  // Navegación hacia atrás (Volver a pasos anteriores)
  if (data === "nav_back_name") {
    const state = getBookingState(userId);
    setBookingState(userId, { ...state, step: "ask_name" });
    await ctx.reply("⬅️ Vamos a corregir tu nombre.\n\nPor favor escribe tu nombre y apellido reales 😊:", {
      reply_markup: { force_reply: true }
    });
    return;
  }

  if (data === "nav_back_doc") {
    const state = getBookingState(userId);
    setBookingState(userId, { ...state, step: "ask_document" });
    await ctx.reply("⬅️ Vamos a corregir tu número de documento.\n\nPor favor ingresa tu número de documento de identidad (Cédula de Ciudadanía, T.I. o DNI) 🪪:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Cambiar Nombre", callback_data: "nav_back_name" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
        ]
      }
    });
    return;
  }

  if (data === "nav_back_specialty") {
    const state = getBookingState(userId);
    setBookingState(userId, { ...state, step: "ask_specialty" });
    const keyboard = PSYCHOLOGY_SPECIALTIES.map(s => ([{
      text: `${s.icon} ${s.name}`, callback_data: `spec_${s.id}`
    }]));
    keyboard.push([
      { text: "⬅️ Cambiar Documento", callback_data: "nav_back_doc" },
      { text: "❌ Cancelar", callback_data: "cancel_booking" }
    ]);
    await ctx.reply("⬅️ Selecciona nuevamente una especialidad:", {
      reply_markup: { inline_keyboard: keyboard }
    });
    return;
  }

  if (data === "nav_back_therapist") {
    const state = getBookingState(userId);
    setBookingState(userId, { ...state, step: "ask_therapist" });
    const therapistButtons = getTherapistsBySpecialty(state.specialty ?? "").map(t => ([{
      text: `${t.icon} ${t.name} (${t.specialty})`, callback_data: `therapist_${t.id}`
    }]));
    therapistButtons.push([
      { text: "⬅️ Cambiar Especialidad", callback_data: "nav_back_specialty" },
      { text: "❌ Cancelar", callback_data: "cancel_booking" }
    ]);
    await ctx.reply("⬅️ Selecciona nuevamente a tu profesional de preferencia:", {
      reply_markup: { inline_keyboard: therapistButtons }
    });
    return;
  }

  if (data === "nav_back_date" || data === "ask_date_retry") {
    const state = getBookingState(userId);
    setBookingState(userId, { ...state, step: "ask_date", pendingDate: undefined });
    await ctx.reply(
      "📅 ¿Qué día y horario prefieres para tu consulta?\n\n_Ejemplo: Mañana a las 10 AM / Viernes a las 3 PM_",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Cambiar Terapeuta", callback_data: "nav_back_therapist" },
              { text: "❌ Cancelar", callback_data: "cancel_booking" }
            ]
          ]
        }
      }
    );
    return;
  }

  // Selección rápida de jornada AM / PM en horario ambiguo
  if (data === "time_meridiem_am" || data === "time_meridiem_pm") {
    const state = getBookingState(userId);
    const meridiem = data === "time_meridiem_am" ? "AM" : "PM";
    const base = state.pendingDate ?? state.date ?? "Mañana a las 10";
    const combinedDate = `${base} ${meridiem}`;

    // Validar conflicto de horario
    const therapist = state.therapist ?? "Dra. Valentina Ríos";
    if (hasPsyAppointmentConflict(therapist, combinedDate)) {
      await ctx.reply(
        `⚠️ *Conflicto de horario:* ${therapist} ya cuenta con una cita en el horario "${combinedDate}".\n\nPor favor escribe otro horario o día para tu consulta:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📅 Elegir otro horario", callback_data: "ask_date_retry" },
                { text: "❌ Cancelar", callback_data: "cancel_booking" }
              ]
            ]
          }
        }
      );
      return;
    }

    // Chequeo de hora pasada en tiempo real si el usuario menciona "hoy"
    if (combinedDate.toLowerCase().includes("hoy")) {
      const nowBogota = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
      const currentHour24 = nowBogota.getHours();
      const currentMinute = nowBogota.getMinutes();
      const timeMatch = combinedDate.toLowerCase().match(/(?:a\s+las?|\bhora:?|\b)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const m = timeMatch[3]?.toLowerCase().replace(/\./g, "");
        if (m === "pm" && hour < 12) hour += 12;
        else if (m === "am" && hour === 12) hour = 0;
        if (hour < currentHour24 || (hour === currentHour24 && minute <= currentMinute)) {
          const ampmNow = currentHour24 >= 12 ? "PM" : "AM";
          const formattedHourNow = `${currentHour24 % 12 || 12}:${currentMinute.toString().padStart(2, "0")} ${ampmNow}`;
          await ctx.reply(
            `⚠️ El horario ${combinedDate} ya pasó el día de hoy (en este momento son las ${formattedHourNow} en Colombia).\n\nPor favor escribe un horario más tarde para hoy o una fecha a partir de mañana (ej: 'Hoy a las 4 PM', 'Mañana a las 10 AM') 📅:`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "📅 Elegir otro horario", callback_data: "ask_date_retry" },
                    { text: "❌ Cancelar", callback_data: "cancel_booking" }
                  ]
                ]
              }
            }
          );
          return;
        }
      }
    }

    setBookingState(userId, { ...state, step: "ask_motive", date: combinedDate, pendingDate: undefined });
    await ctx.reply(
      `📌 Perfecto, horario confirmado: *${combinedDate}*.\n\n¿Cuál es el motivo principal de tu consulta? (Puedes ser breve, ej: 'Estrés laboral y ansiedad') 🌿:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Cambiar Horario", callback_data: "nav_back_date" },
              { text: "❌ Cancelar", callback_data: "cancel_booking" }
            ]
          ]
        }
      }
    );
    return;
  }

  // Confirmación final
  if (data === "confirm_booking") {
    const state = getBookingState(userId);
    const spec = PSYCHOLOGY_SPECIALTIES.find(s => s.name === state.specialty) ?? PSYCHOLOGY_SPECIALTIES[0];

    if (state.step !== "confirm" || !state.name || !state.specialty || !state.therapist || !state.date || !state.motive) {
      await ctx.reply("⚠️ La reserva está incompleta o ya venció. Inicia de nuevo con /cita.");
      clearBookingState(userId);
      return;
    }
    if (hasPsyAppointmentConflict(state.therapist, state.date)) {
      await ctx.reply("⚠️ Ese horario acaba de ser reservado. Elige otro horario para continuar.");
      setBookingState(userId, { ...state, step: "ask_date" });
      return;
    }

    const appt = createPsyAppointment({
      patientId: userId,
      patientName: state.name,
      documentNumber: state.documentNumber,
      therapist: state.therapist,
      specialty: state.specialty,
      dateTime: state.date,
      motive: state.motive,
      status: "Confirmada",
      notes: "Agendada vía Telegram Bot"
    });

    await saveCalendarEvent(ctx.from, `Cita Psicología: ${spec.name} — ${state.name}`, state.date);
    await saveLog(ctx.chat!.id, "CITA_PSI", `Cita ${appt.id} agendada para ${state.name} (${appt.documentNumber ?? ''}) con ${state.therapist}`);

    // Auto-registro en CRM Clínico si no existe
    const existingPatient = getPatientById(state.name ?? "");
    if (!existingPatient) {
      createPatient({
        fullName: state.name ?? displayName(ctx),
        document: state.documentNumber ? `CC-${state.documentNumber}` : "CC-" + Math.floor(100000000 + Math.random() * 900000000),
        age: 26,
        phone: "+57 (Telegram)",
        email: `${ctx.from?.username ?? 'paciente'}@telegram.org`,
        pipelineStage: "Primera_Cita",
        diagnosticHypothesis: state.motive ? `Motivo: ${state.motive}` : "En evaluación inicial",
        assignedTherapist: appt.therapist,
        specialty: appt.specialty,
        tags: ["Telegram", "Lead"]
      });
    }

    clearBookingState(userId);

    await ctx.reply([
      "🎉 ¡CITA AGENDADA CON ÉXITO! 💙",
      "",
      `🎟️ Código: ${appt.id}`,
      `👤 Paciente: ${appt.patientName}`,
      appt.documentNumber ? `🪪 Documento: ${appt.documentNumber}` : "",
      `${spec.icon} Especialidad: ${appt.specialty}`,
      `👤 Terapeuta: ${appt.therapist}`,
      `🏢 Consultorio: ${spec.office}`,
      `⏰ Horario: ${appt.dateTime}`,
      appt.motive ? `📌 Motivo: ${appt.motive}` : "",
      "📅 Sincronizado en Google Calendar.",
      "📁 Expediente clínico activado en el CRM.",
      "",
      "💡 *¿Olvidaste para cuándo era tu cita?*",
      `Puedes consultarla en cualquier momento con: \`/consultar ${appt.documentNumber ?? appt.id}\` o preguntando "¿para cuándo es mi cita?".`,
      "",
      "Recuerda llegar 10 minutos antes. ¡Fue un placer acompañarte! 🌿",
      `🌐 Panel Web: ${APP_BASE_URL}/citas`
    ].filter(Boolean).join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📅 Ver Cita en Panel Web ↗", url: `${APP_BASE_URL}/citas` },
            { text: "💼 Ver en CRM Clínico ↗", url: `${APP_BASE_URL}/crm` }
          ]
        ]
      }
    });
    return;
  }

  if (data === "cancel_booking") {
    clearBookingState(userId);
    await ctx.reply("❌ Agendamiento cancelado. Cuando quieras, escribe /cita para intentarlo de nuevo. 💙");
    return;
  }

  if (data === "crm_view_payments") {
    const payments = getAllPayments();
    const metrics = getCRMMetrics();
    const formatCOP = (num: number) => `$${num.toLocaleString('es-CO')} COP`;
    const payLines = payments.slice(0, 4).map(p => `• *${p.patientName}* — ${formatCOP(p.amount)} [${p.status}]`).join("\n");
    await ctx.reply(`💳 *PAGOS Y FACTURACIÓN CLÍNICA*\n\nRecaudado: ${formatCOP(metrics.totalRevenue)}\nPendiente: ${formatCOP(metrics.pendingRevenue)}\n\n${payLines}\n\n🌐 Más detalles: ${APP_BASE_URL}/crm`, { parse_mode: "Markdown" });
    return;
  }

  if (data === "burnout_low") {
    await ctx.reply([
      "🟢 *Nivel de Burnout: BAJO / SALUDABLE*",
      "",
      "Tus recursos psicológicos y niveles de energía se encuentran estables.",
      "Consejo preventivo: Mantén tus límites entre tiempo de estudio/trabajo y descanso personal. ¡Excelente autocuidado! 🌿"
    ].join("\n"), { parse_mode: "Markdown" });
    return;
  }

  if (data === "burnout_med") {
    await ctx.reply([
      "🟡 *Nivel de Burnout: MODERADO (ZONA DE ALERTA)*",
      "",
      "Estás experimentando desgaste acumulado. El cuerpo y la mente te están pidiendo pausas estratégicas.",
      "Te sugerimos:",
      "• Aplicar la receta conductual con /formula.",
      "• Hacer pausas activas de 5 minutos cada 50 minutos de trabajo.",
      "• Considerar una sesión preventiva con /cita."
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💊 Ver Fórmula Conductual", callback_data: "get_formula" }],
          [{ text: "📅 Agendar Cita de Apoyo", callback_data: "book_start" }]
        ]
      }
    });
    return;
  }

  if (data === "burnout_high") {
    await ctx.reply([
      "🔴 *Nivel de Burnout: SEVERO / AGOTAMIENTO CRÓNICO*",
      "",
      "⚠️ Presentas síntomas significativos de sobrecarga psicofisiológica que afectan tu bienestar y desempeño.",
      "Por favor no lo ignores: el síndrome de burnout no se resuelve solo con 'echarle ganas', requiere intervención y reajuste de cargas.",
      "",
      "💙 Estamos aquí para acompañarte sin juicios."
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📅 Agendar Cita Prioritaria con Terapeuta", callback_data: "book_start" }],
          [{ text: "🌬️ Respiración Anti-Estrés", callback_data: "breath_guide" }]
        ]
      }
    });
    return;
  }

  if (data === "get_formula") {
    await ctx.reply("💡 Escribe /formula para generar tu receta médica conductual personalizada.");
    return;
  }
});


// Comando para consultar cita por documento o ID (para cuando el paciente olvida la fecha)
bot.command(["consultar", "consultarcita", "buscarcita", "micita", "recordarcita"], async (ctx) => {
  const arg = commandArg(ctx).trim();
  const userId = String(ctx.from?.id ?? "");

  if (arg) {
    const cleanDoc = arg.replace(/[^\w\-]/g, "");
    const found = getPsyAppointmentsByDocument(cleanDoc);
    if (found.length === 0) {
      await ctx.reply([
        `❌ No se encontraron citas activas asociadas al documento o código *${arg}*.`,
        "",
        "💡 Si necesitas agendar una nueva cita, escribe /cita o pulsa el botón abajo."
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "📅 Agendar Cita", callback_data: "book_start" }]]
        }
      });
      return;
    }

    const lines = found.map(a =>
      `• 🎟️ *Código:* \`${a.id}\`\n  📅 *Fecha y Horario:* *${a.dateTime}*\n  🩺 *Especialidad:* ${a.specialty}\n  👤 *Especialista:* ${a.therapist}\n  🪪 *Documento:* ${a.documentNumber ?? 'Registrado'}\n  🏷️ *Estado:* ${a.status}${a.motive ? `\n  📌 *Motivo:* ${a.motive}` : ""}`
    ).join("\n\n");

    await ctx.reply([
      `📋 *CITAS ENCONTRADAS PARA EL DOCUMENTO ${arg} (${found.length}):*`,
      "",
      lines,
      "",
      "🏢 Recuerda presentarte 10 minutos antes en las instalaciones de MindCare con tu documento de identidad original.",
      `🌐 Consultar también en el portal web: ${APP_BASE_URL}/citas?consultar_doc=${encodeURIComponent(cleanDoc)}`
    ].join("\n"), { parse_mode: "Markdown" });
    return;
  }

  // Si no pasó argumento, primero buscar si tiene citas con su telegramId
  const myApps = getPatientPsyAppointments(userId);
  if (myApps.length > 0) {
    const lines = myApps.map(a =>
      `• 🎟️ *Código:* \`${a.id}\`\n  📅 *Fecha y Horario:* *${a.dateTime}*\n  🩺 *Especialidad:* ${a.specialty}\n  👤 *Especialista:* ${a.therapist}${a.documentNumber ? `\n  🪪 *Documento:* ${a.documentNumber}` : ""}\n  🏷️ *Estado:* ${a.status}${a.motive ? `\n  📌 *Motivo:* ${a.motive}` : ""}`
    ).join("\n\n");

    await ctx.reply([
      `📋 *TUS CITAS PROGRAMADAS (${myApps.length}):*`,
      "",
      lines,
      "",
      "💡 *¿Consultar por número de documento?*",
      "Usa: `/consultar <número_documento>` (ej: `/consultar 1020304050`)."
    ].join("\n"), { parse_mode: "Markdown" });
    return;
  }

  // Si no tiene citas registradas con su telegramId y no pasó argumento
  await ctx.reply([
    "🪪 *CONSULTAR FECHA Y HORA DE TU CITA*",
    "",
    "¿Olvidaste para cuándo quedó tu cita de psicología?",
    "",
    "Por favor escribe tu número de documento para buscarla:",
    "👉 `/consultar <número_documento>`",
    "",
    "Ejemplo: `/consultar 1020304050`",
    "",
    "O también puedes simplemente escribir tu número de documento aquí en el chat."
  ].join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "📅 Agendar Nueva Cita", callback_data: "book_start" }]]
    }
  });
});

bot.command(["miscitas", "citas"], async (ctx) => {
  const arg = commandArg(ctx).trim();
  const userId = String(ctx.from?.id ?? "");

  let myApps = arg ? getPsyAppointmentsByDocument(arg) : getPatientPsyAppointments(userId);
  if (arg && myApps.length === 0) {
    myApps = getPatientPsyAppointments(arg);
  }

  if (myApps.length === 0) {
    await ctx.reply([
      "📋 No encontramos citas de psicología programadas.",
      "",
      "• Si conoces tu número de documento: `/consultar <número>`",
      "• Para agendar escribe /cita y te guío paso a paso. 💙"
    ].join("\n"), {
      reply_markup: {
        inline_keyboard: [[{ text: "📅 Agendar Cita Ahora", callback_data: "book_start" }]]
      }
    });
    return;
  }

  const lines = myApps.map(a =>
    `• [${a.id}] ${a.specialty} con ${a.therapist}\n  ⏰ ${a.dateTime} · Estado: ${a.status}${a.documentNumber ? `\n  🪪 Doc: ${a.documentNumber}` : ""}${a.motive ? `\n  📌 ${a.motive}` : ""}`
  ).join("\n\n");

  await ctx.reply([
    `📋 TUS CITAS DE PSICOLOGÍA (${myApps.length}):`,
    "",
    lines,
    "",
    "Para cancelar: /cancelarcita <ID>",
    "Para consultar por documento: /consultar <documento>"
  ].join("\n"));
});

bot.command("cancelarcita", async (ctx) => {
  const id = commandArg(ctx).trim();
  if (!id) {
    await ctx.reply("Uso: /cancelarcita <ID_CITA>\nEjemplo: /cancelarcita psi-101");
    return;
  }
  const appointment = getPatientPsyAppointments(String(ctx.from?.id ?? "")).find(a => a.id === id);
  const ok = appointment ? cancelPsyAppointment(id) : false;
  await ctx.reply(ok
    ? `✅ Cita ${id} cancelada. Si necesitas reagendar, usa /cita. 💙`
    : `❌ No encontré la cita ${id}. Revisa con /miscitas.`
  );
});

bot.command(["terapeutas", "especialidades", "psicologos"], async (ctx) => {
  const lines = PSYCHOLOGY_SPECIALTIES.map(s =>
    `${s.icon} *${s.name}*\n  👤 ${s.therapist} · ${s.office}\n  🕐 ${s.waitTime}\n  📌 ${s.description}`
  ).join("\n\n");

  await ctx.reply(`🧠 DIRECTORIO DE TERAPEUTAS — MINDCARE\n\n${lines}\n\nAgenda con /cita`, { parse_mode: "Markdown" });
});

bot.command("crisis", async (ctx) => {
  await ctx.reply([
    "🆘 RECURSOS DE APOYO EN CRISIS 🆘",
    "",
    "Si estás pasando por un momento muy difícil, aquí tienes ayuda inmediata:",
    "",
    "🇨🇴 Línea 106 — Salud Mental (Colombia, gratis, 24/7)",
    "📞 123 — Emergencias (peligro inmediato)",
    "🌍 findahelpline.com — Líneas internacionales",
    "",
    "💙 Técnica de respiración (4-4-4):",
    "Inhala 4 seg → Sostén 4 seg → Exhala 4 seg. Repite 4 veces.",
    "",
    "🌿 Recuerda: pedir ayuda es un acto de valentía.",
    "Escríbeme en cualquier momento: !<cómo te sientes>"
  ].join("\n"), {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📅 Hablar con un Terapeuta — Agendar Cita", callback_data: "book_start" }]
      ]
    }
  });
});

bot.command("juegos", async (ctx) => ctx.reply(gamesMenu()));

bot.command("integraciones", async (ctx) => {
  await ctx.reply([
    "🔌 Integraciones",
    "",
    "/portal - Autorizar apps desde la página",
    "/github usuario/repositorio - Revisar repo",
    "/youtube tema - Buscar videos",
    "/calendar evento | fecha hora | titulo - Crear evento demo",
    "/guardar tipo | dato | descripcion - Registrar dato demo",
    "",
    "Con DATABASE_URL se guarda en Neon. Sin DATABASE_URL funciona como demo."
  ].join("\n"));
});

bot.command("portal", async (ctx) => {
  await ctx.reply([
    "🔐 Portal de autorización",
    `${APP_BASE_URL}/autorizar?telegramChatId=${ctx.chat.id}`,
    "",
    "Desde ahí el usuario puede volver a Telegram autorizando Calendar, GitHub o YouTube."
  ].join("\n"));
});

bot.command("score", async (ctx) => {
  const total = await addScore(ctx.from, "consulta_score", 0);
  await ctx.reply(total === null
    ? "🏆 Score disponible cuando conectes DATABASE_URL. Los juegos igual funcionan en memoria."
    : `🏆 Puntos registrados: ${total}`);
});

bot.command("github", async (ctx) => githubCommand(ctx, commandArg(ctx)));
bot.command("youtube", async (ctx) => youtubeCommand(ctx, commandArg(ctx)));
bot.command(["calendar", "calendario"], async (ctx) => calendarCommand(ctx, commandArg(ctx)));
bot.command("guardar", async (ctx) => guardarCommand(ctx, commandArg(ctx)));

for (const cmd of ["trivia", "concurso", "adivina", "ahorcado", "ppt", "dado", "moneda", "8ball", "ruleta", "pareja", "ship", "top", "verdad", "reto", "mision", "parejas"]) {
  bot.command(cmd, async (ctx) => handleGameCommand(ctx, cmd, commandArg(ctx)));
}

bot.command("perfil", async (ctx) => {
  const dbUser = await ensureUser(ctx.from);
  if (!dbUser) return ctx.reply("Perfil disponible cuando DATABASE_URL esté conectada.");
  await ctx.reply([
    `👤 PERFIL DE ${displayName(ctx)} ${dbUser.vip ? "🌟 [VIP]" : ""}`,
    dbUser.customTitle ? `🏷️ Título: ${dbUser.customTitle}` : "",
    `📈 Nivel: ${dbUser.level} (XP: ${dbUser.xp})`,
    `💰 Monedas: ${dbUser.money}`,
    `✨ Karma: ${dbUser.karma}`,
    `🏅 Cuenta creada: ${dbUser.createdAt.toLocaleDateString()}`
  ].filter(Boolean).join("\n"));
});

bot.command("daily", async (ctx) => {
  const amount = 50 + Math.floor(Math.random() * 50);
  const updated = await addMoney(ctx.from, amount);
  if (!updated) return ctx.reply("Necesitas conectar la base de datos.");
  await ctx.reply(`🎁 Recompensa diaria: Has recibido ${amount} monedas. Tienes un total de ${updated.money} monedas.`);
});


bot.command("reir", async (ctx) => {
  const target = commandArg(ctx) || displayName(ctx);
  await ctx.sendChatAction("typing");
  const response = await askAI(`El usuario ${displayName(ctx)} se está riendo de ${target}. Búrlate de forma sarcástica.`, "niko");
  await ctx.reply(response);
});

bot.command("golpear", async (ctx) => {
  const target = commandArg(ctx) || "la nada";
  if (target.toLowerCase().includes("ache")) {
    await ctx.reply("🛡️ Ni en tus sueños. A Ache nadie lo toca, don nadie.");
    return;
  }
  await ctx.sendChatAction("typing");
  const response = await askAI(`El usuario ${displayName(ctx)} quiere golpear a ${target}. Narra cómo ${displayName(ctx)} falla miserablemente o cómo lo castigas por violento.`, "niko");
  await ctx.reply(response);
});

bot.command("marry", async (ctx) => handleMarryCommand(ctx, commandArg(ctx)));
bot.command("divorce", async (ctx) => handleDivorceCommand(ctx));
bot.command("matrimonios", async (ctx) => getMarriages(ctx));

bot.command(["s", "sticker"], async (ctx) => handleStickerCommand(ctx));
bot.command(["extraer", "robar"], async (ctx) => handleExtraerCommand(ctx));

bot.command("warn", async (ctx) => handleWarnCommand(ctx, commandArg(ctx)));
bot.command(["ban", "kick"], async (ctx) => handleBanCommand(ctx));
bot.command("antilink", async (ctx) => handleAntiLinkCommand(ctx, commandArg(ctx)));
bot.command(["antiporno", "nsfw"], async (ctx) => handleAntiPornoCommand(ctx, commandArg(ctx)));
bot.command(["broadcast", "bc", "anuncio"], async (ctx) => handleBroadcastCommand(ctx, commandArg(ctx)));

bot.command("play", async (ctx) => handlePlayCommand(ctx, commandArg(ctx)));
bot.command("tiktok", async (ctx) => handleTiktokCommand(ctx, commandArg(ctx)));
bot.command(["tts", "habla"], async (ctx) => handleTtsCommand(ctx, commandArg(ctx)));

bot.on("new_chat_members", async (ctx) => {
  const dbGroup = await ensureGroup(ctx.chat as any);
  if (dbGroup && dbGroup.welcomeMode !== "off") {
    for (const member of ctx.message.new_chat_members) {
      if (member.id === ctx.botInfo.id) {
        await ctx.reply("¡Gracias por añadirme a este grupo! Soy el bot de Juan. Usa /menu para empezar.");
      } else {
        await ctx.reply(`👋 ¡Bienvenido/a al grupo, @${member.username || member.first_name}! 🎉\nPásala genial y no olvides usar /perfil.`);
      }
    }
  }
});

bot.on("left_chat_member", async (ctx) => {
  const dbGroup = await ensureGroup(ctx.chat as any);
  if (dbGroup && dbGroup.welcomeMode !== "off") {
    const member = ctx.message.left_chat_member;
    await ctx.reply(`🚪 @${member.username || member.first_name} ha abandonado el grupo. Se le va a extrañar... o no.`);
  }
});

bot.command("welcome", async (ctx) => {
  if (!ctx.chat || ctx.chat.type === "private") return;
  const dbGroup = await ensureGroup(ctx.chat as any);
  if (!dbGroup || !prisma) return;

  const mode = dbGroup.welcomeMode === "off" ? "on" : "off";
  await prisma.group.update({ where: { id: dbGroup.id }, data: { welcomeMode: mode } });
  await ctx.reply(`Mensajes de bienvenida y despedida: ${mode === "on" ? "🟢 ACTIVADOS" : "🔴 DESACTIVADOS"}`);
});

bot.command("shop", async (ctx) => handleShopCommand(ctx));
bot.command("buy", async (ctx) => handleBuyCommand(ctx, commandArg(ctx)));
bot.command(["topxp", "rank"], async (ctx) => handleTopXpCommand(ctx));
bot.command(["topmoney", "topdinero", "ricos"], async (ctx) => handleTopMoneyCommand(ctx));
bot.command("afk", async (ctx) => handleAfkCommand(ctx, commandArg(ctx)));
bot.command(["encuesta", "poll", "votar"], async (ctx) => handlePollCommand(ctx, commandArg(ctx)));
bot.command(["traducir", "tr", "translate"], async (ctx) => {
  let arg = commandArg(ctx);
  const replyMessage = ctx.message && (ctx.message as any).reply_to_message;
  if (!arg && replyMessage && replyMessage.text) {
    arg = replyMessage.text; // Translate the replied message if no text is given
  }
  return handleTranslateCommand(ctx, arg);
});
bot.command(["search", "google", "buscar"], async (ctx) => handleSearchCommand(ctx, commandArg(ctx)));
bot.command(["bomba", "snap", "secreto"], async (ctx) => handleSnapCommand(ctx, commandArg(ctx)));
bot.command(["qr", "codigoqr"], async (ctx) => handleQrCommand(ctx, commandArg(ctx)));

bot.on("text", async (ctx) => {
  // Anti-Spam
  if (checkSpam(ctx)) return;

  const text = ctx.message.text.trim();
  const lowerText = text.toLowerCase();
  const userId = String(ctx.from?.id ?? "0");

  await checkAfkStatus(ctx).catch(() => {});


  // Anti-link en grupos
  if (ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup")) {
    const dbGroup = await ensureGroup(ctx.chat as any);
    if (dbGroup?.antiLink && text.match(/https?:\/\/[^\s]+/i)) {
      try {
        await ctx.deleteMessage(ctx.message.message_id);
        await ctx.reply(`🚫 @${ctx.from.username || ctx.from.first_name}, los enlaces no están permitidos en este grupo.`);
      } catch (e) {}
      return;
    }
  }

  // XP por mensajes
  const xpResult = await addXp(ctx.from, 10 + Math.floor(Math.random() * 15));
  if (xpResult?.leveledUp) {
    await ctx.reply(`🎉 ¡Subiste al Nivel ${xpResult.user.level}! 💙`);
  }

  const handled = await maybeHandleGameAnswer(ctx, text);
  if (handled) return;

  // ================================================================
  // FLUJO CONVERSACIONAL DE CITA PSI (procesa respuestas paso a paso)
  // ================================================================
  const bookingState = getBookingState(userId);

  // Constantes de Validación Clínica para Agendamiento
  const PROFANITY_PATTERN = /\b(perra|perro|mierda|hp|hdp|puta|puto|hijueputa|malparido|gonorrea|pirobo|carechimba|chimba|verga|estupido|estúpido|imbecil|imbécil|pendejo|idiota|culiado|coño|maldito|maldita|malagradecido|malagradecida|desgraciado|desgraciada|incompetente|inutil|inútil|fea|feo|loca|loco|bruja|brujo|payaso|payasa|tarado|tarada)\b/i;
  const TROLL_NAMES = ["epstein", "hitler", "stalin", "peppa pig", "goku", "vegeta", "naruto", "shrek", "anonymous", "nadie", "alguien", "tu papa", "tu papá", "tu mama", "tu mamá"];
  const PAST_TIME_KEYWORDS = ["ayer", "antier", "anteayer", "el mes pasado", "la semana pasada", "el año pasado", "hace un", "hace 2", "hace 3", "hace días", "hace dias", "ya paso", "ya pasó"];
  const EVASIVE_MOTIVES = [
    "que te importa", "qué te importa", "que le importa", "no te importa", "no te interesa", 
    "no se", "no sé", "porque si", "porque sí", "porque quise", "nada", "ninguno", 
    "asdf", "jaja", "jajaja", "xd", "xdd", "nose", "cualquiera", "me da igual"
  ];

  function isGibberishOrGarbage(input: string): boolean {
    const trimmed = input.trim();
    if (/^[\.\,\;\:\-\_\!\?\¿\¡\@\#\$\%\^\&\*\(\)\=\+\/\\\|<>\s]{2,}$/.test(trimmed)) return true;
    if (/(.)\1{3,}/i.test(trimmed)) return true;
    const lettersOnly = trimmed.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, "");
    if (lettersOnly.length < 3) return true;
    if (!/[aeiouáéíóú]/i.test(lettersOnly)) return true;
    return false;
  }

  // Opción de cancelar o volver en cualquier momento por texto
  if (bookingState.step && bookingState.step !== "idle") {
    if (lowerText === "cancelar" || text === "/cancelar" || lowerText === "menu" || lowerText === "menú" || text === "/menu" || text === "/start") {
      clearBookingState(userId);
      await ctx.reply("❌ Agendamiento cancelado. Puedes escribir /menu para ver las opciones disponibles o /cita para agendar cuando quieras. 💙");
      return;
    }

    if (lowerText === "volver" || text === "/volver" || lowerText === "atras" || lowerText === "atrás" || text === "/atras" || lowerText === "anterior") {
      if (bookingState.step === "ask_motive") {
        setBookingState(userId, { ...bookingState, step: "ask_date" });
        await ctx.reply("⬅️ ¿Qué día y horario prefieres para tu consulta? (ej: 'Mañana a las 10 AM', 'Viernes a las 3 PM') 📅:", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Cambiar Terapeuta", callback_data: "nav_back_therapist" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
            ]
          }
        });
        return;
      }
      if (bookingState.step === "ask_date") {
        setBookingState(userId, { ...bookingState, step: "ask_therapist" });
        const therapistButtons = getTherapistsBySpecialty(bookingState.specialty ?? "").map(t => ([{
          text: `${t.icon} ${t.name} (${t.specialty})`, callback_data: `therapist_${t.id}`
        }]));
        therapistButtons.push([{ text: "⬅️ Cambiar Especialidad", callback_data: "nav_back_specialty" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]);
        await ctx.reply("⬅️ ¿Con qué profesional prefieres atenderte?", {
          reply_markup: { inline_keyboard: therapistButtons }
        });
        return;
      }
      if (bookingState.step === "ask_therapist") {
        setBookingState(userId, { ...bookingState, step: "ask_specialty" });
        const keyboard = PSYCHOLOGY_SPECIALTIES.map(s => ([{
          text: `${s.icon} ${s.name}`, callback_data: `spec_${s.id}`
        }]));
        keyboard.push([{ text: "⬅️ Cambiar Documento", callback_data: "nav_back_doc" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]);
        await ctx.reply("⬅️ Selecciona una especialidad:", {
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }
      if (bookingState.step === "ask_specialty") {
        setBookingState(userId, { ...bookingState, step: "ask_document" });
        await ctx.reply("⬅️ ¿Cuál es tu número de documento de identidad (Cédula, T.I. o DNI)? 🪪:", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Cambiar Nombre", callback_data: "nav_back_name" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
            ]
          }
        });
        return;
      }
      if (bookingState.step === "ask_document") {
        setBookingState(userId, { ...bookingState, step: "ask_name" });
        await ctx.reply("⬅️ ¿Cuál es tu nombre y apellido completos? 😊:", {
          reply_markup: { force_reply: true }
        });
        return;
      }
    }
  }

  if (bookingState.step === "ask_name" && !text.startsWith("!") && !text.startsWith("/")) {
    const cleanName = text.trim();
    const lowerName = cleanName.toLowerCase();

    if (isGibberishOrGarbage(cleanName)) {
      await ctx.reply("⚠️ El nombre ingresado contiene caracteres repetidos o símbolos sin sentido. Por favor escribe tu nombre y apellido reales 😊:");
      return;
    }

    if (PROFANITY_PATTERN.test(cleanName)) {
      await ctx.reply("⚠️ Por favor utiliza un lenguaje respetuoso y adecuado para un entorno clínico profesional. ¿Cuál es tu nombre y apellido reales? 😊:");
      return;
    }

    if (TROLL_NAMES.some(t => lowerName.includes(t))) {
      await ctx.reply("⚠️ Por favor ingresa tu nombre y apellido reales (ej: Carlos Gómez) para poder generar tu ficha clínica legal reglamentaria 📋:");
      return;
    }

    if (cleanName.length < 3 || /^\d+$/.test(cleanName) || cleanName.split(/\s+/).length < 2) {
      await ctx.reply("⚠️ Por favor escribe tu nombre y apellido completos (mínimo nombre y apellido, ej: 'Andrés López') para registrarte en la ficha clínica 😊:");
      return;
    }

    setBookingState(userId, { ...bookingState, step: "ask_document", name: cleanName });

    await ctx.reply(
      `Gracias, *${cleanName}* 😊\n\n🪪 Ahora, por favor ingresa tu *número de documento de identidad* (Cédula de Ciudadanía, Tarjeta de Identidad o DNI):\n\n_💡 Con este número queda registrada tu cita en el sistema y podrás consultar para cuándo quedó si se te llega a olvidar._`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Cambiar Nombre", callback_data: "nav_back_name" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
          ]
        }
      }
    );
    return;
  }

  if (bookingState.step === "ask_document" && !text.startsWith("!") && !text.startsWith("/")) {
    const rawDoc = text.trim();
    const cleanDigits = rawDoc.replace(/\D/g, "");

    if (isGibberishOrGarbage(rawDoc)) {
      await ctx.reply("⚠️ El documento ingresado contiene símbolos repetidos o texto inválido. Por favor escribe tu número de documento de identidad (ej: 1020304050) 🪪:");
      return;
    }

    if (PROFANITY_PATTERN.test(rawDoc)) {
      await ctx.reply("⚠️ Por favor ingresa un número de documento de identidad válido y con respeto 🪪:");
      return;
    }

    if (cleanDigits.length < 5 || cleanDigits.length > 12) {
      await ctx.reply("⚠️ El número de documento debe contener entre 5 y 12 dígitos numéricos válidos (ej: 1020304050). Por favor verifica e ingrésalo de nuevo 🪪:");
      return;
    }

    const docNumber = cleanDigits || rawDoc;
    setBookingState(userId, { ...bookingState, step: "ask_specialty", documentNumber: docNumber });

    const keyboard = PSYCHOLOGY_SPECIALTIES.map(s => ([{
      text: `${s.icon} ${s.name}`, callback_data: `spec_${s.id}`
    }]));
    keyboard.push([
      { text: "⬅️ Cambiar Documento", callback_data: "nav_back_doc" },
      { text: "❌ Cancelar", callback_data: "cancel_booking" }
    ]);

    await ctx.reply(
      `🪪 Documento registrado: *${docNumber}* ✅\n\n¿Sobre qué área necesitas apoyo? Selecciona una especialidad:`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } }
    );
    return;
  }

  if (bookingState.step === "ask_date" && !text.startsWith("!") && !text.startsWith("/")) {
    let cleanDate = text.trim();
    let lowerDate = cleanDate.toLowerCase();

    // 0. Si el usuario ya tenía una fecha ambigua registrada (ej: dijo "hoy a las 2" y ahora dice "en la tarde", "tarde", "pm", "si", "sí")
    if (bookingState.pendingDate) {
      if (/(tarde|pm|noche|p\.m\.|s[ií]|claro|de una|dale|listo)/i.test(lowerDate)) {
        cleanDate = `${bookingState.pendingDate} PM`;
        lowerDate = cleanDate.toLowerCase();
      } else if (/(ma[ñn]ana|am|madrugada|a\.m\.)/i.test(lowerDate)) {
        cleanDate = `${bookingState.pendingDate} AM`;
        lowerDate = cleanDate.toLowerCase();
      }
    }

    if (isGibberishOrGarbage(cleanDate)) {
      await ctx.reply("⚠️ El formato de fecha ingresado no es válido. Por favor escribe un día y hora claro (ej: 'Mañana a las 10 AM', 'Viernes a las 3 PM') 📅:");
      return;
    }

    if (PROFANITY_PATTERN.test(cleanDate)) {
      await ctx.reply("⚠️ Por favor mantengamos un lenguaje respetuoso. ¿Qué día y horario prefieres para tu consulta? (ej: 'Mañana a las 10 AM', 'Viernes a las 3 PM') 📅:");
      return;
    }

    if (PAST_TIME_KEYWORDS.some(p => lowerDate.includes(p))) {
      await ctx.reply("⚠️ No es posible agendar una cita en el pasado ('ayer'). Por favor indícanos un día y horario futuro a partir de hoy o mañana (ej: 'Mañana a las 10 AM', 'Viernes a las 3 PM' o 'Lunes a las 9 AM') 📅:");
      return;
    }

    // Normalizar expresiones coloquiales con jornada (ej: "hoy a las 2 de la tarde" -> "hoy a las 2 PM")
    if (/(de la tarde|en la tarde|por la tarde|de la noche|en la noche)/i.test(lowerDate) && !/(am|pm)/i.test(lowerDate)) {
      cleanDate = cleanDate.replace(/(de la tarde|en la tarde|por la tarde|de la noche|en la noche)/gi, "PM").trim();
      lowerDate = cleanDate.toLowerCase();
    } else if (/(de la ma[ñn]ana|en la ma[ñn]ana|por la ma[ñn]ana|de la madrugada)/i.test(lowerDate) && !/(am|pm)/i.test(lowerDate)) {
      cleanDate = cleanDate.replace(/(de la ma[ñn]ana|en la ma[ñn]ana|por la ma[ñn]ana|de la madrugada)/gi, "AM").trim();
      lowerDate = cleanDate.toLowerCase();
    }

    // Validación de ambigüedad AM / PM en horas numéricas sin formato 24h
    const hasAmPm = /(am|pm|a\.m\.|p\.m\.)/i.test(lowerDate);
    const has24h = /\b([0-2]?[0-9]):[0-5][0-9]\b/.test(lowerDate);
    const hourOnlyMatch = lowerDate.match(/(?:a\s+las?|\bhora:?|\b)\s*(\d{1,2})(?::(\d{2}))?\b/i);

    if (!hasAmPm && !has24h && hourOnlyMatch) {
      const h = parseInt(hourOnlyMatch[1], 10);
      const min = hourOnlyMatch[2] ? parseInt(hourOnlyMatch[2], 10) : 0;
      if (h >= 1 && h <= 12) {
        const nowBogota = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
        const currentHour24 = nowBogota.getHours();
        const currentMinute = nowBogota.getMinutes();
        const formattedHourNow = `${currentHour24 % 12 || 12}:${currentMinute.toString().padStart(2, "0")} ${currentHour24 >= 12 ? "PM" : "AM"}`;

        const isMentioningToday = lowerDate.includes("hoy") || (!lowerDate.includes("mañana") && !/(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i.test(lowerDate));

        if (isMentioningToday) {
          const amHour24 = h === 12 ? 0 : h;
          const pmHour24 = h === 12 ? 12 : h + 12;
          const amPassed = (amHour24 < currentHour24) || (amHour24 === currentHour24 && min <= currentMinute);
          const pmPassed = (pmHour24 < currentHour24) || (pmHour24 === currentHour24 && min <= currentMinute);

          if (amPassed && pmPassed) {
            await ctx.reply(
              `⚠️ Las ${h}:00 de hoy ya pasaron tanto en la mañana (${h} AM) como en la tarde (${h} PM) (en este momento son las ${formattedHourNow} en Colombia).\n\nPor favor elige un horario más tarde para hoy o una fecha a partir de mañana (ej: 'Hoy a las ${Math.min(currentHour24 + 1, 23)}:00', 'Mañana a las ${h} PM') 📅:`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "⬅️ Cambiar Terapeuta", callback_data: "nav_back_therapist" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
                  ]
                }
              }
            );
            return;
          }

          if (amPassed && !pmPassed) {
            // AM ya pasó, el único turno viable para hoy es PM!
            setBookingState(userId, { ...bookingState, pendingDate: cleanDate });
            await ctx.reply(
              `⏰ Detecté que las *${h}:00 AM* de hoy ya pasaron.\n¿Te refieres a las *${h}:00 PM (de la tarde)* hoy? 🌤️`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: `✅ Sí, hoy a las ${h}:00 PM`, callback_data: "time_meridiem_pm" },
                      { text: "📅 No, otro horario", callback_data: "ask_date_retry" }
                    ],
                    [
                      { text: "⬅️ Cambiar Terapeuta", callback_data: "nav_back_therapist" },
                      { text: "❌ Cancelar", callback_data: "cancel_booking" }
                    ]
                  ]
                }
              }
            );
            return;
          }
        }

        // Si AM aún no ha pasado o es en otra fecha futura
        setBookingState(userId, { ...bookingState, pendingDate: cleanDate });
        await ctx.reply(
          `⚠️ Anoté *"${cleanDate}"*, pero por favor especifica si te refieres a la mañana o a la tarde (AM o PM):\n\nSelecciona un botón o responde *"tarde"* / *"mañana"*:`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: `☀️ ${h}:00 AM (Mañana)`, callback_data: `time_meridiem_am` },
                  { text: `🌤️ ${h}:00 PM (Tarde)`, callback_data: `time_meridiem_pm` }
                ],
                [
                  { text: "⬅️ Cambiar Terapeuta", callback_data: "nav_back_therapist" },
                  { text: "❌ Cancelar", callback_data: "cancel_booking" }
                ]
              ]
            }
          }
        );
        return;
      }
    }

    // Chequeo de hora pasada en tiempo real si el usuario menciona "hoy"
    if (lowerDate.includes("hoy")) {
      const nowBogota = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
      const currentHour24 = nowBogota.getHours();
      const currentMinute = nowBogota.getMinutes();

      // Buscar patrones de hora: "6 am", "6:30 am", "6 pm", "a las 6"
      const timeMatch = lowerDate.match(/(?:a\s+las?|\bhora:?|\b)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const meridiem = timeMatch[3]?.toLowerCase().replace(/\./g, "");

        if (meridiem === "pm" && hour < 12) {
          hour += 12;
        } else if (meridiem === "am" && hour === 12) {
          hour = 0;
        } else if (!meridiem && hour < 8) {
          hour += 12;
        }

        if (hour < currentHour24 || (hour === currentHour24 && minute <= currentMinute)) {
          const ampmNow = currentHour24 >= 12 ? "PM" : "AM";
          const formattedHourNow = `${currentHour24 % 12 || 12}:${currentMinute.toString().padStart(2, "0")} ${ampmNow}`;
          await ctx.reply(
            `⚠️ La hora indicada en el día de hoy ya pasó (en este momento son las ${formattedHourNow} en Colombia).\n\nPor favor elige un horario más tarde para hoy o una fecha a partir de mañana (ej: 'Hoy a las 4 PM', 'Mañana a las 10 AM') 📅:`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📅 Elegir otro horario", callback_data: "ask_date_retry" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
                ]
              }
            }
          );
          return;
        }
      }
    }

    if (cleanDate.length < 4 || ["nunca", "jamas", "jamás", "despues", "después", "cualquiera"].some(v => lowerDate.includes(v))) {
      await ctx.reply("⚠️ Por favor escribe un día y horario específico, por ejemplo: 'Mañana a las 10 AM', 'Viernes a las 4 PM' o 'Lunes 3:00 PM' 📅:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Cambiar Terapeuta", callback_data: "nav_back_therapist" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
          ]
        }
      });
      return;
    }

    // Si solo escribió "en la tarde" o "mañana" sin hora previa
    if (!hourOnlyMatch && !has24h && !/(?:a\s+las?|\b\d{1,2}\b)/.test(cleanDate)) {
      await ctx.reply("⚠️ Por favor incluye también la hora de tu consulta (ej: 'Hoy a las 4 PM', 'Mañana a las 10 AM' o 'Viernes a las 2 PM') 📅:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Cambiar Terapeuta", callback_data: "nav_back_therapist" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
          ]
        }
      });
      return;
    }

    const therapist = bookingState.therapist ?? "Dra. Valentina Ríos";
    if (hasPsyAppointmentConflict(therapist, cleanDate)) {
      await ctx.reply(
        `⚠️ *Conflicto de horario:* ${therapist} ya cuenta con una cita en el horario "${cleanDate}".\n\nPor favor escribe otro horario o día para tu consulta (ej: 1 hora más tarde o al día siguiente):`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📅 Elegir otro horario", callback_data: "ask_date_retry" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
            ]
          }
        }
      );
      return;
    }

    setBookingState(userId, { ...bookingState, step: "ask_motive", date: cleanDate, pendingDate: undefined });

    await ctx.reply(
      `📌 Perfecto, anotado: *${cleanDate}*.\n\n¿Cuál es el motivo principal de tu consulta? (Puedes ser breve)`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Cambiar Horario", callback_data: "nav_back_date" }, { text: "❌ Cancelar", callback_data: "cancel_booking" }]
          ]
        }
      }
    );
    return;
  }

  if (bookingState.step === "ask_motive" && !text.startsWith("!") && !text.startsWith("/")) {
    const cleanMotive = text.trim();
    const lowerMotive = cleanMotive.toLowerCase();

    if (isGibberishOrGarbage(cleanMotive)) {
      await ctx.reply("⚠️ El motivo ingresado contiene caracteres sin sentido o puntos repetidos. Por favor describe brevemente qué deseas abordar en tu sesión 😊:");
      return;
    }

    if (PROFANITY_PATTERN.test(cleanMotive)) {
      await ctx.reply("⚠️ En un espacio de salud mental cuidamos la comunicación con respeto. Por favor describe con respeto el motivo principal de tu consulta 🌿:");
      return;
    }

    // Detección de saludos cordiales que no constituyen un motivo de consulta
    const GREETINGS_LIST = [
      "hola", "hola como estas", "hola cómo estás", "hola como esta", "hola que tal", "buenas", 
      "buenos dias", "buenos días", "buenas tardes", "buenas noches", "saludos", "que tal", 
      "¿cómo estás?", "como estas", "cómo estás", "como estas?", "hola bot", "hey", "oe", "oli"
    ];
    if (GREETINGS_LIST.some(g => lowerMotive === g || lowerMotive.startsWith(g + " ") || lowerMotive.startsWith(g + ","))) {
      await ctx.reply(
        "⚠️ Tu mensaje parece un saludo cordial, pero para coordinar tu cita necesitamos que nos indiques brevemente el motivo clínico o emocional (ej: 'Ansiedad ante exámenes', 'Insomnio y estrés', 'Dificultades de pareja' o 'Duelo reciente') 🌿:"
      );
      return;
    }

    if (EVASIVE_MOTIVES.some(e => lowerMotive.includes(e)) || cleanMotive.length < 5) {
      await ctx.reply("⚠️ Para asignarte el enfoque terapéutico adecuado y que el psicólogo prepare tu sesión, requerimos un motivo de consulta genuino (ej: 'Manejo de ansiedad y estrés', 'Insomnio frecuente', 'Dificultades de pareja' o 'Baja autoestima').\n\n¿Cuál es el motivo por el cual solicitas la cita? 🌿:");
      return;
    }

    // Validación inteligente con IA de Dra. PsiBot
    await ctx.sendChatAction("typing");
    try {
      const aiVerdictRaw = await askAI(
        `Evalúa si este texto es un motivo válido y genuino de consulta psicológica o salud mental: "${cleanMotive}".
Si es un insulto, queja agresiva ("malagradecida", etc.), saludo, troleo, texto incoherente o no tiene relación con salud mental, responde: INVALIDO: <breve razón>.
Si es un motivo aceptable de consulta (ej: ansiedad, insomnio, problemas de pareja, orientación, estrés, tristeza, problemas familiares, etc.), responde: VALIDO.
Responde ÚNICAMENTE en una línea con una de esas dos opciones.`,
        "Eres un clasificador estricto de triaje clínico de salud mental. Evalúa con ética y rigor."
      );
      if (aiVerdictRaw.toUpperCase().includes("INVALIDO")) {
        const reason = aiVerdictRaw.replace(/^INVALIDO:?\s*/i, "").trim();
        await ctx.reply(
          `⚠️ El texto ingresado no es un motivo de consulta psicológica válido${reason ? ` (${reason})` : ""}.\n\nPara que tu terapeuta prepare tu sesión, por favor describe brevemente qué deseas tratar (ej: 'Ansiedad ante exámenes', 'Insomnio y estrés', 'Dificultades de pareja' o 'Duelo reciente') 🌿:`
        );
        return;
      }
    } catch (e) {}

    const updated = { ...bookingState, step: "confirm" as const, motive: cleanMotive };
    setBookingState(userId, updated);
    const spec = PSYCHOLOGY_SPECIALTIES.find(s => s.name === updated.specialty) ?? PSYCHOLOGY_SPECIALTIES[0];

    await ctx.reply([
      "✅ *Resumen de tu cita:*",
      "",
      `👤 Paciente: ${updated.name}`,
      updated.documentNumber ? `🪪 Documento: ${updated.documentNumber}` : "",
      `${spec.icon} Especialidad: ${updated.specialty}`,
      `👤 Terapeuta: ${updated.therapist}`,
      `⏰ Horario: ${updated.date}`,
      `📌 Motivo: ${updated.motive}`,
      "",
      "¿Confirmamos la cita?"
    ].filter(Boolean).join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirmar Cita", callback_data: "confirm_booking" }],
          [
            { text: "⬅️ Cambiar Horario", callback_data: "nav_back_date" },
            { text: "❌ Cancelar", callback_data: "cancel_booking" }
          ]
        ]
      }
    });
    return;
  }

  // =============================================================================
  // CONSULTA INTELIGENTE DE CITA (Si el paciente olvidó la fecha/hora)
  // =============================================================================
  if (!bookingState.step || bookingState.step === "idle") {
    const isForgottenAppointmentQuery =
      /(para cu[aá]ndo|cu[aá]ndo|a qu[eé] hora|fecha de mi|hora de mi|olvid[eé]|se me olvid[oó]|recordar).*(mi cita|la cita|cita)/i.test(lowerText) ||
      /^(cu[aá]ndo es mi cita|para cu[aá]ndo es mi cita|a qu[eé] hora es mi cita|mi cita para cu[aá]ndo es|olvid[eé] mi cita|se me olvid[oó] mi cita)\??$/i.test(lowerText);

    if (isForgottenAppointmentQuery) {
      const myApps = getPatientPsyAppointments(userId);
      if (myApps.length > 0) {
        const lines = myApps.map(a =>
          `• 🎟️ *Código:* \`${a.id}\`\n  📅 *Fecha y Horario:* *${a.dateTime}*\n  🩺 *Especialidad:* ${a.specialty}\n  👤 *Especialista:* ${a.therapist}${a.documentNumber ? `\n  🪪 *Documento:* ${a.documentNumber}` : ""}\n  🏷️ *Estado:* ${a.status}`
        ).join("\n\n");
        await ctx.reply([
          "📅 *¡Aquí tienes los datos de tu cita programada!* 💙",
          "",
          lines,
          "",
          "🏢 Te esperamos 10 minutos antes en las instalaciones de MindCare.",
          "💡 Si deseas agendar otra cita, usa /cita."
        ].join("\n"), { parse_mode: "Markdown" });
        return;
      }

      await ctx.reply([
        "🪪 *¿Olvidaste para cuándo quedó tu cita?*",
        "",
        "Con gusto te ayudo a consultarla. Por favor indícame tu *número de documento de identidad* (Cédula o DNI):",
        "",
        "Ejemplo: `/consultar 1020304050` o escribe solo los números aquí."
      ].join("\n"), { parse_mode: "Markdown" });
      return;
    }

    // Si el usuario escribe directamente un número de documento suelto (5 a 12 dígitos)
    const digitsOnly = text.trim();
    if (/^\d{5,12}$/.test(digitsOnly) && !text.startsWith("/") && !text.startsWith("!")) {
      const foundAppointments = getPsyAppointmentsByDocument(digitsOnly);
      if (foundAppointments.length > 0) {
        const lines = foundAppointments.map(a =>
          `• 🎟️ *Código:* \`${a.id}\`\n  📅 *Fecha y Horario:* *${a.dateTime}*\n  🩺 *Especialidad:* ${a.specialty}\n  👤 *Especialista:* ${a.therapist}\n  🪪 *Documento:* ${a.documentNumber ?? digitsOnly}\n  🏷️ *Estado:* ${a.status}${a.motive ? `\n  📌 *Motivo:* ${a.motive}` : ""}`
        ).join("\n\n");

        await ctx.reply([
          `📋 *ENCONTRAMOS TU CITA ASOCIADA AL DOCUMENTO ${digitsOnly}:*`,
          "",
          lines,
          "",
          "🏢 Recuerda presentarte 10 minutos antes en las instalaciones de MindCare.",
          `🌐 Ver en portal: ${APP_BASE_URL}/citas?consultar_doc=${digitsOnly}`
        ].join("\n"), { parse_mode: "Markdown" });
        return;
      }
    }
  }

  // IA solo si empieza con "!" o "/ia" / "/ai"
  const isAiPrompt = text.startsWith("!") || text.startsWith("/ia") || text.startsWith("/ai");
  if (!isAiPrompt) return;

  await ensureUser(ctx.from);
  const promptText = text.replace(/^(!|\/ia|\/ai)\s*/i, "").trim();
  if (!promptText) {
    await ctx.reply("💙 Cuéntame, ¿cómo te sientes? Escribe después del signo de admiración.\nEjemplo: !me siento muy ansioso");
    return;
  }

  const lower = promptText.toLowerCase();

  // Detección de YouTube
  if (lower.includes("youtube") || lower.includes("video de ") || lower.includes("buscar video") || lower.includes("busca en youtube")) {
    const cleanQuery = promptText.replace(/(busca en youtube|buscar en youtube|en youtube|videos de|video de|buscar video|youtube)/gi, "").trim();
    if (cleanQuery) { await ctx.sendChatAction("typing"); await youtubeCommand(ctx, cleanQuery); return; }
  }

  // Detección de GitHub
  const repoMatch = promptText.match(/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)/);
  if ((lower.includes("github") || lower.includes("repo") || lower.includes("repositorio")) && repoMatch) {
    await ctx.sendChatAction("typing"); await githubCommand(ctx, repoMatch[0]); return;
  }

  // 1. Protocolo Clínico de Detección de Crisis y Riesgo de Autolesión
  const crisisKeywords = [
    "suicid", "no quiero vivir", "acabar con mi vida", "matarme", "quitarme la vida", 
    "morirme", "hacerme daño", "cortarme", "desaparecer para siempre", "no vale la pena vivir",
    "quiero morir", "ya no aguanto más vivir", "ya no aguanto mas vivir"
  ];
  if (crisisKeywords.some(k => lower.includes(k))) {
    flagPatientRisk(displayName(ctx), "Alerta de crisis detectada por lenguaje natural");
    await saveLog(ctx.chat!.id, "ALERTA_CRISIS", `Alerta de riesgo activada para usuario ${displayName(ctx)}: "${promptText}"`);
    await ctx.reply([
      "🚨 *PROTOCOLO DE EMERGENCIA Y APOYO EN CRISIS* 🚨",
      "",
      `💙 *${displayName(ctx)}, tu vida es valiosa y no tienes que atravesar este dolor a solas.*`,
      "",
      "Detectamos que estás pasando por un momento de profundo dolor o angustia desbordante. Por favor, comunícate ahora mismo con personal de contención psicológica gratuita, confidencial y disponible 24/7:",
      "",
      "🇨🇴 *Colombia:*",
      "• 📞 *Línea 106* (Atención y contención en salud mental)",
      "• 📞 *Línea 192* / *123* (Urgencias médicas y rescate)",
      "• 💬 *Línea Calma:* 01 8000 423 614",
      "",
      "🇲🇽 *México:* Línea de la Vida — 800 911 2000",
      "🇪🇸 *España:* Línea 024 — Prevención de la conducta suicida",
      "🇦🇷 *Argentina:* Centro de Asistencia al Suicida — 135",
      "🌍 *Otros países:* https://findahelpline.com",
      "",
      "🌿 *Por favor respira despacio: Inhala en 4s, retén 4s y exhala en 4s.* Si estás con un familiar o amigo, cuéntale de inmediato cómo te sientes. Estamos contigo."
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🆘 Ver Más Recursos de Crisis", callback_data: "crisis_info" }],
          [{ text: "📅 Agendar Cita Prioritaria con Psicólogo", callback_data: "book_start" }]
        ]
      }
    });
    return;
  }

  // 2. Detección de agendamiento de cita psi por intención explícita
  const bookingIntentKeywords = [
    "agendar cita", "pedir cita", "sacar cita", "programar cita", "nueva cita", 
    "reservar cita", "apartar cita", "quiero una cita", "agéndame", "agendame"
  ];
  if (bookingIntentKeywords.some(k => lower.includes(k))) {
    await ctx.sendChatAction("typing");
    clearBookingState(userId);
    setBookingState(userId, { step: "ask_name" });
    await ctx.reply(
      "💙 Claro, con gusto te ayudo a agendar tu cita de psicología.\n\n¿Cuál es tu nombre completo o cómo prefieres que te llamemos?",
      { reply_markup: { force_reply: true } }
    );
    return;
  }

  // 3. Conversación con IA (Dra. PsiBot orienta y valida emociones sin interrumpir)
  await ctx.sendChatAction("typing");
  const answer = await askAI(promptText);
  await ctx.reply(answer);
});

bot.on("photo", async (ctx) => {
  if (ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup")) {
    const dbGroup = await ensureGroup(ctx.chat as any);
    if (dbGroup?.antiPorno) {
      await ctx.reply("🔍 (Demo AntiPorno) Imagen escaneada por seguridad NSFW. Todo en orden.");
    }
  }
});

bot.on("voice", async (ctx) => {
  await handleVoiceNote(ctx);
});

bot.catch((err) => {
  console.error("Error del bot:", err);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Portal Web listo y disponible en http://0.0.0.0:${PORT}`);
});

if (BOT_TOKEN && !BOT_TOKEN.includes("dummy") && !BOT_TOKEN.includes("pega_aqui")) {
  bot.launch()
    .catch((err) => console.warn("Telegram bot no pudo conectar a Telegram API (verifica conexión/token). Portal Web sigue activo.", err));
  console.log(`🤖 Bot de Telegram (@${BOT_USERNAME}) INICIADO Y ESCUCHANDO EN VIVO!`);
} else {
  console.log("Portal Web activo en modo local/demo (sin BOT_TOKEN de Telegram).");
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

async function githubCommand(ctx: Context, repo: string) {
  if (!repo || !repo.includes("/")) {
    await ctx.reply("Uso: /github usuario/repositorio");
    return;
  }
  const headers: Record<string, string> = { "User-Agent": "telegram-bot-juan" };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const response = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  if (!response.ok) {
    await ctx.reply(`GitHub respondió ${response.status}. Revisa el repo o usa GITHUB_TOKEN para privados.`);
    return;
  }
  const data = await response.json() as {
    full_name: string;
    description?: string;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    updated_at: string;
  };
  const result = [
    `🐙 ${data.full_name}`,
    `Descripción: ${data.description ?? "Sin descripción"}`,
    `Stars: ${data.stargazers_count}`,
    `Forks: ${data.forks_count}`,
    `Issues abiertas: ${data.open_issues_count}`,
    `Última actualización: ${data.updated_at}`,
    "",
    "BD: se guarda repo, chat, resultado y fecha."
  ].join("\n");
  await saveGithubCheck(ctx.chat!.id, repo, result);
  await ctx.reply(result);
}

async function youtubeCommand(ctx: Context, query: string) {
  if (!query) {
    await ctx.reply("Uso: /youtube tutorial telegram bot");
    return;
  }
  if (!YOUTUBE_API_KEY) {
    const result = `▶️ YouTube modo demo\nBuscaría videos sobre: ${query}\nConfigura YOUTUBE_API_KEY para búsqueda real.`;
    await saveYoutubeSearch(ctx.chat!.id, query, result);
    await ctx.reply(result);
    return;
  }
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "3");
  url.searchParams.set("q", query);
  url.searchParams.set("key", YOUTUBE_API_KEY);

  const response = await fetch(url);
  if (!response.ok) {
    await ctx.reply(`YouTube respondió ${response.status}. Revisa la API key.`);
    return;
  }
  const data = await response.json() as { items: Array<{ id: { videoId: string }; snippet: { title: string } }> };
  const result = data.items.map((item) => `- ${item.snippet.title}\nhttps://www.youtube.com/watch?v=${item.id.videoId}`).join("\n");
  await saveYoutubeSearch(ctx.chat!.id, query, result);
  await ctx.reply(result || "No encontré videos.");
}

async function calendarCommand(ctx: Context, arg: string) {
  const [action, startsAt, title] = parseParts(arg);
  if (normalize(action) !== "evento" || !startsAt || !title) {
    await ctx.reply("Uso: /calendar evento | 2026-09-10 15:00 | Entrega del proyecto");
    return;
  }
  await saveCalendarEvent(ctx.from, title, startsAt);
  await ctx.reply([
    "📅 Evento creado en modo demo",
    `Fecha/hora: ${startsAt}`,
    `Título: ${title}`,
    "",
    "En producción se enviaría a Google Calendar con el token OAuth del /portal."
  ].join("\n"));
}

async function guardarCommand(ctx: Context, arg: string) {
  const [type, value, detail] = parseParts(arg);
  if (!type || !value || !detail) {
    await ctx.reply("Uso: /guardar tipo | dato | descripcion");
    return;
  }
  await saveLog(ctx.chat!.id, type, `${value} - ${detail}`);
  await ctx.reply([
    "💾 Dato guardado en modo demo",
    `Tipo: ${type}`,
    `Dato: ${value}`,
    `Descripción: ${detail}`,
    "",
    "Con Neon activo queda persistido en la tabla logs o en la tabla del módulo."
  ].join("\n"));
}



function authCard(title: string, payload: string, description: string) {
  return `<a class="card" href="https://t.me/${BOT_USERNAME}?start=${payload}">
    <strong>${title}</strong><span>${description}</span>
  </a>`;
}

function page(title: string, body: string) {
  return `<!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      body{margin:0;font-family:Arial,sans-serif;background:#f6f8fb;color:#172033}
      main{max-width:900px;margin:0 auto;padding:44px 20px}
      h1{font-size:34px;margin:0 0 12px}
      p{font-size:17px;line-height:1.5}
      .btn,.card{display:inline-block;border-radius:8px;padding:12px 16px;text-decoration:none}
      .btn{background:#1f6feb;color:#fff}
      .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:22px}
      .card{background:#fff;color:#172033;border:1px solid #d9e0ea;box-shadow:0 8px 24px #0001}
      .card strong{display:block;font-size:20px;margin-bottom:8px}
      .card span{display:block;color:#526071;line-height:1.4}
      .note{margin-top:26px;color:#526071}
    </style>
  </head>
  <body><main><h1>${title}</h1>${body}</main></body>
  </html>`;
}

function commandArg(ctx: Context) {
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  return text.replace(/^\/\w+(@\w+)?\s*/i, "").trim();
}

function getStartPayload(ctx: Context) {
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  return text.replace(/^\/start(@\w+)?\s*/i, "").trim();
}

function displayName(ctx: Context) {
  return ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name ?? "usuario";
}

function parseParts(text: string) {
  return text.split("|").map((part) => part.trim());
}

function normalize(text = "") {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

async function shutdown(signal: string) {
  console.log(`Cerrando por ${signal}`);
  bot.stop(signal);
  await disconnectDb();
  process.exit(0);
}
