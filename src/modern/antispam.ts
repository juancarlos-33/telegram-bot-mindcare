import type { Context } from "telegraf";

// Almacena el ID del usuario y la fecha de su último mensaje
const userLastMessage = new Map<number, number>();

export function checkSpam(ctx: Context): boolean {
  if (!ctx.from) return false;

  // En chats privados (1 a 1 entre el paciente y el bot), NUNCA bloquear al usuario por escribir rápido
  // Los usuarios suelen enviar mensajes cortos o correcciones en rápida sucesión.
  if (ctx.chat?.type === "private") {
    return false;
  }

  const now = Date.now();
  const userId = ctx.from.id;
  const lastMsgTime = userLastMessage.get(userId);

  // En grupos públicos: Si el usuario envió un mensaje hace menos de 800 ms, evitar flood masivo
  if (lastMsgTime && (now - lastMsgTime < 800)) {
    return true; // Es flood en grupo
  }

  // Guardamos el tiempo actual sólo en mensajes válidos
  userLastMessage.set(userId, now);
  return false;
}
