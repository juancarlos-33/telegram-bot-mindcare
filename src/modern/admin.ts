import type { Context } from "telegraf";
import { prisma, ensureUser, ensureGroup } from "./db.js";

// Note: To kick or ban users, the bot must be an Administrator in the Telegram group.

export async function handleWarnCommand(ctx: Context, arg: string) {
  const replyTo = ctx.message && 'reply_to_message' in ctx.message ? ctx.message.reply_to_message : null;
  if (!ctx.chat || ctx.chat.type === "private") {
    await ctx.reply("Este comando solo funciona en grupos.");
    return;
  }
  
  if (!replyTo || !replyTo.from) {
    await ctx.reply("Debes responder al mensaje del usuario que quieres advertir.");
    return;
  }

  // Ensure both users exist in DB
  const dbTarget = await ensureUser(replyTo.from);
  const dbGroup = await ensureGroup(ctx.chat as any);

  if (!dbTarget || !dbGroup || !prisma) {
    await ctx.reply("Error conectando con la base de datos.");
    return;
  }

  // Count existing warnings
  const warnings = await prisma.warning.count({
    where: { userId: dbTarget.id, groupId: dbGroup.id }
  });

  const newWarningCount = warnings + 1;
  const reason = arg || "Comportamiento inadecuado";

  await prisma.warning.create({
    data: {
      userId: dbTarget.id,
      groupId: dbGroup.id,
      reason
    }
  });

  if (newWarningCount >= 3) {
    // If they reach 3 warnings, ban them
    await ctx.reply(`⚠️ @${replyTo.from.username || replyTo.from.first_name} ha alcanzado 3 advertencias por: ${reason}.\n🔨 Procediendo a expulsar...`);
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, replyTo.from.id);
      await ctx.reply("✅ Usuario expulsado del grupo automáticamente.");
      
      // Optionally reset their warnings
      await prisma.warning.deleteMany({
        where: { userId: dbTarget.id, groupId: dbGroup.id }
      });
    } catch (e) {
      await ctx.reply("❌ No pude expulsar al usuario. ¿Tengo permisos de administrador?");
    }
  } else {
    await ctx.reply(`⚠️ Advertencia ${newWarningCount}/3 para @${replyTo.from.username || replyTo.from.first_name}.\nRazón: ${reason}`);
  }
}

export async function handleBanCommand(ctx: Context) {
  const replyTo = ctx.message && 'reply_to_message' in ctx.message ? ctx.message.reply_to_message : null;
  if (!ctx.chat || ctx.chat.type === "private") {
    await ctx.reply("Este comando solo funciona en grupos.");
    return;
  }

  if (!replyTo || !replyTo.from) {
    await ctx.reply("Debes responder al mensaje del usuario que quieres banear.");
    return;
  }

  await ctx.sendChatAction("typing");

  try {
    await ctx.telegram.banChatMember(ctx.chat.id, replyTo.from.id);
    await ctx.reply(`🔨 @${replyTo.from.username || replyTo.from.first_name} ha sido erradicado del grupo por orden del administrador.`);
    
    // Also mark banned in DB globally if needed, but usually it's just from the group.
    const dbTarget = await ensureUser(replyTo.from);
    if (dbTarget && prisma) {
      await prisma.user.update({ where: { id: dbTarget.id }, data: { banned: true } });
    }
  } catch (e) {
    await ctx.reply("❌ Mmm, no pude banearlo. Revisa si soy admin y si ese usuario no es admin también.");
  }
}

export async function handleAntiLinkCommand(ctx: Context, arg: string) {
  if (!ctx.chat || ctx.chat.type === "private") return;
  const dbGroup = await ensureGroup(ctx.chat as any);
  if (!dbGroup || !prisma) return;

  const action = arg.toLowerCase().trim();
  if (action === "on") {
    await prisma.group.update({ where: { id: dbGroup.id }, data: { antiLink: true } });
    await ctx.reply("🛡️ Modo Anti-Link ACTIVADO. Eliminaré automáticamente cualquier enlace enviado al grupo.");
  } else if (action === "off") {
    await prisma.group.update({ where: { id: dbGroup.id }, data: { antiLink: false } });
    await ctx.reply("🔓 Modo Anti-Link DESACTIVADO. Ya pueden enviar enlaces.");
  } else {
    await ctx.reply(`El Anti-Link está actualmente: ${dbGroup.antiLink ? "🔴 ACTIVADO" : "🟢 DESACTIVADO"}.\nUsa /antilink on u /antilink off.`);
  }
}

export async function handleAntiPornoCommand(ctx: Context, arg: string) {
  if (!ctx.chat || ctx.chat.type === "private") return;
  const dbGroup = await ensureGroup(ctx.chat as any);
  if (!dbGroup || !prisma) return;

  const action = arg.toLowerCase().trim();
  if (action === "on") {
    await prisma.group.update({ where: { id: dbGroup.id }, data: { antiPorno: true } });
    await ctx.reply("🔞 Filtro Anti-Nude ACTIVADO. Las imágenes inapropiadas serán borradas.");
  } else if (action === "off") {
    await prisma.group.update({ where: { id: dbGroup.id }, data: { antiPorno: false } });
    await ctx.reply("🔓 Filtro Anti-Nude DESACTIVADO.");
  } else {
    await ctx.reply(`El Anti-Porno está actualmente: ${dbGroup.antiPorno ? "🔴 ACTIVADO" : "🟢 DESACTIVADO"}.\nUsa /antiporno on u /antiporno off.`);
  }
}

export async function handleBroadcastCommand(ctx: Context, message: string) {
  // In a real scenario, you'd check if ctx.from.id matches the bot owner's Telegram ID.
  // For demo purposes, we will just let it run.
  if (!message) {
    await ctx.reply("Uso: /broadcast <mensaje para todos los grupos y usuarios>");
    return;
  }

  if (!prisma) return;

  await ctx.reply("📢 Iniciando transmisión global (Broadcast)... esto puede tomar un momento.");

  const groups = await prisma.group.findMany();
  let success = 0;

  for (const group of groups) {
    try {
      await ctx.telegram.sendMessage(group.telegramId, `📢 **ANUNCIO DEL CREADOR** 📢\n\n${message}`);
      success++;
      // Sleep slightly to avoid hitting rate limits
      await new Promise(r => setTimeout(r, 50));
    } catch (e) {
      // Group might have kicked the bot
    }
  }

  await ctx.reply(`✅ Transmisión completada. Mensaje enviado a ${success} grupos.`);
}

export async function handleBotStatusCommand(ctx: Context, arg: string) {
  if (!ctx.chat || ctx.chat.type === "private") {
    await ctx.reply("Este comando solo funciona en grupos.");
    return;
  }
  const dbGroup = await ensureGroup(ctx.chat as any);
  if (!dbGroup || !prisma) {
    await ctx.reply("Base de datos no disponible.");
    return;
  }

  const action = arg.toLowerCase().trim();
  if (action === "off" || action === "desactivar" || action === "desautorizar") {
    await prisma.group.update({ where: { id: dbGroup.id }, data: { botDisabled: true } });
    await ctx.reply("🛑 Bot DESAUTORIZADO / DESACTIVADO en este grupo.\nNo responderá a comandos ni juegos hasta que un administrador use /bot on.");
  } else if (action === "on" || action === "activar" || action === "autorizar") {
    await prisma.group.update({ where: { id: dbGroup.id }, data: { botDisabled: false } });
    await ctx.reply("🟢 Bot AUTORIZADO y ACTIVADO en este grupo.\nTodas las funciones están disponibles.");
  } else {
    await ctx.reply([
      `Estado del bot en este grupo: ${dbGroup.botDisabled ? "🔴 DESAUTORIZADO" : "🟢 AUTORIZADO"}`,
      "",
      "Comandos disponibles:",
      "• /bot off  -> Desautoriza y silencia el bot en este grupo",
      "• /bot on   -> Reactiva el bot en este grupo",
      "• /salir    -> El bot abandona el grupo definitivamente"
    ].join("\n"));
  }
}

export async function handleLeaveCommand(ctx: Context) {
  if (!ctx.chat || ctx.chat.type === "private") {
    await ctx.reply("Este comando solo funciona en grupos.");
    return;
  }
  await ctx.reply("👋 Entendido. Me retiro de este grupo. ¡Hasta luego!");
  try {
    await ctx.telegram.leaveChat(ctx.chat.id);
  } catch (err) {
    await ctx.reply("❌ No pude salir del grupo automáticamente.");
  }
}
