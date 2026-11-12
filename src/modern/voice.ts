import type { Context } from "telegraf";
import { askAI } from "./ai.js";
import { ensureGroup, ensureUser, saveLog } from "./db.js";

const GROQ_KEYS: string[] = (
  process.env.GROQ_API_KEYS 
    ? process.env.GROQ_API_KEYS.split(",").map(k => k.trim()) 
    : [process.env.GROQ_API_KEY]
).filter((k): k is string => Boolean(k));

export async function handleVoiceNote(ctx: Context) {
  if (!ctx.message || !('voice' in ctx.message)) return;

  if (ctx.from) await ensureUser(ctx.from).catch(() => {});
  if (ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup")) {
    await ensureGroup(ctx.chat as any).catch(() => {});
  }

  await ctx.sendChatAction("typing");

  try {
    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    // Descargar el archivo de audio (.oga)
    const audioRes = await fetch(fileLink.href);
    if (!audioRes.ok) {
      await ctx.reply("🎙️ Escuché tu nota de voz, pero no pude descargar el archivo de audio de Telegram.");
      return;
    }

    const audioBuffer = await audioRes.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });

    // Intentar transcripción con Groq Whisper
    let transcribedText = "";
    for (const apiKey of GROQ_KEYS) {
      try {
        const formData = new FormData();
        formData.append("file", audioBlob, "voice_note.ogg");
        formData.append("model", "whisper-large-v3-turbo");
        formData.append("language", "es");
        formData.append("response_format", "json");

        const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData
        });

        if (whisperRes.ok) {
          const data = await whisperRes.json() as { text: string };
          transcribedText = data.text?.trim() ?? "";
          if (transcribedText) break;
        }
      } catch (err) {
        console.warn("Groq Whisper error con una llave, intentando siguiente...", err);
      }
    }

    if (!transcribedText) {
      // Fallback cálido si la API de Whisper no respondiera
      await ctx.reply([
        "🎙️ *Nota de voz recibida (Audio Triage)* 💙",
        "",
        "He recibido y procesado tu nota de voz.",
        "Para brindarte una mejor orientación, ¿podrías también escribirme brevemente qué sientes con !<mensaje> o agendar tu cita con /cita? 🌿"
      ].join("\n"), { parse_mode: "Markdown" });
      return;
    }

    // Si transcribió con éxito: log y respuesta con IA psicológica
    await saveLog(ctx.chat!.id, "VOICE_TRIAGE", `Nota de voz transcrita: "${transcribedText.slice(0, 80)}..."`);

    // Consultar a Dra. PsiBot
    const aiResponse = await askAI(
      `El paciente envió la siguiente nota de voz con sus emociones: "${transcribedText}". Respóndele con calidez, valida su estado de ánimo y sugiérele herramientas de apoyo o agendar una cita.`
    );

    await ctx.reply([
      `🎙️ *Te escuché:* _"${transcribedText}"_`,
      "",
      `🧠 *Dra. PsiBot:*`,
      aiResponse,
      "",
      "🌿 _Si deseas agendar una sesión personalizada, usa /cita o los botones del menú._"
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📅 Agendar Cita con Psicólogo/a", callback_data: "book_start" }],
          [{ text: "🌬️ Respiración Guiada", callback_data: "breath_guide" }]
        ]
      }
    });

  } catch (error) {
    console.error("Error al procesar nota de voz:", error);
    await ctx.reply("🎙️ Tu nota de voz llegó con éxito. Escribe /menu para ver las opciones disponibles.");
  }
}

