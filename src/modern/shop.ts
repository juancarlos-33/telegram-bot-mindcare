import type { Context } from "telegraf";
import { prisma, ensureUser } from "./db.js";

const PRICES = {
  vip: 5000,
  title: 1000
};

export async function handleShopCommand(ctx: Context) {
  await ctx.reply(
    `🛒 **TIENDA DEL BOT** 🛒\n\n` +
    `1️⃣ **VIP (5000 monedas)**: /buy vip\n` +
    `   - Te da acceso a comandos exclusivos y destaca tu perfil.\n\n` +
    `2️⃣ **Título Personalizado (1000 monedas)**: /buy title <tu título>\n` +
    `   - Añade un título único a tu /perfil.\n\n` +
    `Usa /perfil para ver tus monedas o /daily para ganar más.`
  );
}

export async function handleBuyCommand(ctx: Context, arg: string) {
  if (!prisma || !ctx.from) return;

  const dbUser = await ensureUser(ctx.from);
  if (!dbUser) {
    await ctx.reply("❌ Error conectando a la base de datos.");
    return;
  }

  const parts = arg.trim().split(" ");
  const item = parts[0]?.toLowerCase();

  if (item === "vip") {
    if (dbUser.vip) {
      await ctx.reply("🌟 Ya eres VIP. No necesitas comprarlo de nuevo.");
      return;
    }
    if (dbUser.money < PRICES.vip) {
      await ctx.reply(`❌ Fondos insuficientes. Necesitas ${PRICES.vip} monedas, pero tienes ${dbUser.money}.`);
      return;
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: { money: dbUser.money - PRICES.vip, vip: true }
    });

    await ctx.reply("🎉 ¡FELICIDADES! Has comprado el pase VIP. Tu perfil ahora brilla de exclusividad.");
    return;
  }

  if (item === "title") {
    const customTitle = parts.slice(1).join(" ");
    if (!customTitle) {
      await ctx.reply("Uso: /buy title <el título que quieras>");
      return;
    }
    if (dbUser.money < PRICES.title) {
      await ctx.reply(`❌ Fondos insuficientes. Necesitas ${PRICES.title} monedas, pero tienes ${dbUser.money}.`);
      return;
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: { money: dbUser.money - PRICES.title, customTitle }
    });

    await ctx.reply(`🏷️ ¡Compra exitosa! Ahora tu título personalizado es: "${customTitle}".`);
    return;
  }

  await ctx.reply("❌ Artículo no válido. Usa /shop para ver lo que puedes comprar.");
}
