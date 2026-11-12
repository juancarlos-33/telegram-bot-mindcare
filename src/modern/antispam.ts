import type { Context } from "telegraf";

// Almacena el ID del usuario y la fecha de su último mensaje
const userLastMessage = new Map<number, number>();

export function checkSpam(ctx: Context): boolean {
  if (!ctx.from) return false;
  
  const now = Date.now();
  const userId = ctx.from.id;
  const lastMsgTime = userLastMessage.get(userId);

  // Si el usuario envió un mensaje hace menos de 2000 ms (2 segundos), lo consideramos spam
  if (lastMsgTime && (now - lastMsgTime < 1500)) {
    // Actualizamos de todos modos para que siga bloqueado si sigue insistiendo
    userLastMessage.set(userId, now);
    return true; // Es spam
  }

  // Si pasó el filtro, guardamos el tiempo actual y devolvemos false (no es spam)
  userLastMessage.set(userId, now);
  return false;
}
