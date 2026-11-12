package com.mibot;

import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;

import java.io.IOException;

public class Main {
    public static void main(String[] args) {
        // Nos aseguramos de tener el token ANTES de intentar conectarnos
        String token = System.getenv("BOT_TOKEN");
        if (token == null || token.isBlank()) {
            System.out.println("❌ Falta la variable de entorno BOT_TOKEN.");
            System.out.println("En PowerShell, ejecuta primero:");
            System.out.println("    $env:BOT_TOKEN = \"pega_aqui_tu_token_de_BotFather\"");
            return;
        }

        try {
            try {
                new PortalWeb().iniciar();
            } catch (IOException e) {
                System.out.println("No pude iniciar el portal web: " + e.getMessage());
                return;
            }

            TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
            botsApi.registerBot(new MiBot());

            System.out.println("¡Bot encendido y conectado a Telegram con éxito!");
            System.out.println("Ve a la app de Telegram y mándale un mensaje.");
        } catch (TelegramApiException e) {
            System.out.println("Hubo un error al encender el bot: " + e.getMessage());
        }
    }
}
