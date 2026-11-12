package com.mibot;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class PortalWeb {
    private static final String BOT_USERNAME = System.getenv().getOrDefault("BOT_USERNAME", "BotsitoDeJuan_bot");

    public void iniciar() throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "3000"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", this::home);
        server.createContext("/autorizar", this::autorizar);
        server.start();
        System.out.println("Portal web activo en el puerto " + port);
    }

    private void home(HttpExchange exchange) throws IOException {
        responder(exchange, pagina("Portal del Bot",
                "<p>Este portal pertenece al bot de Telegram. Desde aquí el usuario puede verificar Telegram y autorizar aplicaciones externas.</p>"
                        + "<p><a class='btn' href='/autorizar'>Ir a autorizaciones</a></p>"));
    }

    private void autorizar(HttpExchange exchange) throws IOException {
        String html = "<p>Selecciona qué aplicación quieres autorizar para el bot.</p>"
                + "<div class='grid'>"
                + boton("Calendar", "auth_calendar", "Permite crear y consultar eventos.")
                + boton("GitHub", "auth_github", "Permite revisar repositorios, commits e issues.")
                + boton("YouTube", "auth_youtube", "Permite consultar videos y canales.")
                + "</div>"
                + "<p class='note'>En esta versión académica el botón vuelve a Telegram y registra el permiso en modo demo. "
                + "En producción, aquí se conectaría OAuth y Neon guardaría usuario, integración, token cifrado, alcance y fecha.</p>";
        responder(exchange, pagina("Autorizar Aplicaciones", html));
    }

    private String boton(String titulo, String payload, String descripcion) {
        String url = "https://t.me/" + BOT_USERNAME + "?start=" + payload;
        return "<a class='card' href='" + url + "'>"
                + "<strong>" + titulo + "</strong>"
                + "<span>" + descripcion + "</span>"
                + "</a>";
    }

    private String pagina(String titulo, String contenido) {
        return "<!doctype html><html lang='es'><head><meta charset='utf-8'>"
                + "<meta name='viewport' content='width=device-width, initial-scale=1'>"
                + "<title>" + titulo + "</title>"
                + "<style>"
                + "body{margin:0;font-family:Arial,sans-serif;background:#f5f7fb;color:#172033}"
                + "main{max-width:880px;margin:0 auto;padding:48px 20px}"
                + "h1{font-size:34px;margin:0 0 12px}p{font-size:17px;line-height:1.5}"
                + ".btn,.card{display:inline-block;background:#1f6feb;color:white;text-decoration:none;border-radius:8px;padding:12px 16px}"
                + ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-top:22px}"
                + ".card{background:white;color:#172033;border:1px solid #d8dee9;box-shadow:0 8px 24px #0001}"
                + ".card strong{display:block;font-size:20px;margin-bottom:8px}.card span{display:block;color:#526071;line-height:1.4}"
                + ".note{margin-top:26px;color:#526071}"
                + "</style></head><body><main><h1>" + titulo + "</h1>" + contenido + "</main></body></html>";
    }

    private void responder(HttpExchange exchange, String html) throws IOException {
        byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
