package com.mibot;

import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.methods.ActionType;
import org.telegram.telegrambots.meta.api.methods.send.SendChatAction;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;
import java.util.concurrent.ThreadLocalRandom;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

public class MiBot extends TelegramLongPollingBot {

    private static final String BOT_USERNAME = System.getenv().getOrDefault("BOT_USERNAME", "BotsitoDeJuan_bot");
    private static final String BOT_TOKEN = System.getenv("BOT_TOKEN");
    private static final String GROQ_API_KEY = System.getenv("GROQ_API_KEY");
    private static final String MODELO_IA = System.getenv().getOrDefault("GROQ_MODEL", "llama-3.1-8b-instant");
    private static final String APP_BASE_URL = System.getenv().getOrDefault("APP_BASE_URL", "http://localhost:3000");
    private static final String GITHUB_TOKEN = System.getenv("GITHUB_TOKEN");
    private static final String YOUTUBE_API_KEY = System.getenv("YOUTUBE_API_KEY");

    private static final int MAX_MENSAJES_MEMORIA = 10;

    private final Map<Long, List<JsonObject>> memoria = new HashMap<>();
    private final Map<Long, PreguntaTrivia> triviaActiva = new HashMap<>();
    private final Map<String, Integer> puntajes = new HashMap<>();
    private final Map<Long, AdivinaEstado> adivinaActiva = new HashMap<>();
    private final Map<Long, AhorcadoEstado> ahorcadoActivo = new HashMap<>();
    private final Map<String, MisionDiaria> misiones = new HashMap<>();
    private final Map<Long, CompetenciaParejas> competencias = new HashMap<>();
    private final Map<Long, Set<String>> permisosDemo = new HashMap<>();

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private static final String[] CHISTES = {
            "- ¡Camarero, este plátano está blando!\n- Pues dígale que se calle. 🍌",
            "— Doctor, tengo dos preguntas.\n— Dígame.\n— ¿Cuál era la primera? 🩺",
            "¿Qué le dice un byte a otro byte?\nNos vemos en el bus. 💻",
            "¿Por qué Java fue al psicólogo? Porque tenía demasiadas clases internas."
    };

    private static final String[] FACTS = {
            "Telegram permite bots con comandos, botones, webhooks y deep links.",
            "OAuth sirve para que un usuario autorice una app sin entregar su contraseña.",
            "Neon puede guardar datos en PostgreSQL y Railway puede alojar el backend.",
            "GitHub tiene API para revisar commits, issues, pull requests y repositorios.",
            "YouTube Data API permite consultar videos y canales usando una API key."
    };

    private static final String[] CONSEJOS = {
            "Divide el proyecto por módulos: usuario, admin, integraciones, juegos y base de datos.",
            "Nunca guardes tokens en texto plano. Usa variables de entorno o cifrado.",
            "Para el profe, explica qué dato se guarda, cuándo se guarda y para qué se usa.",
            "Primero implementa el flujo feliz; luego agregas errores, permisos y validaciones.",
            "Un buen bot debe responder claro cuando una integración todavía no está conectada."
    };

    private static final String[] FRASES = {
            "Un proyecto grande se gana por módulos pequeños bien terminados.",
            "Hoy compila, mañana conquista el calendario.",
            "La base de datos no es relleno: es la memoria formal del sistema.",
            "Si el usuario autoriza bien, el bot trabaja mejor."
    };

    private static final String[] PREDICCIONES = {
            "Veo un commit exitoso en tu futuro cercano.",
            "Tu profesor va a pedir explicación de la base de datos otra vez, así que documentémosla bien.",
            "Railway y Neon van a aguantar el demo si cuidas las variables de entorno.",
            "Alguien va a probar /dado antes que /github, segurísimo."
    };

    private static final String[] PIROPOS = {
            "Tu lógica brilla más que un build sin errores.",
            "Tienes más flow que un webhook bien configurado.",
            "Si fueras endpoint, serías 200 OK.",
            "Tu proyecto tiene pinta de entregar justo a tiempo."
    };

    private static final String[] VERDADES = {
            "¿Qué módulo del proyecto te parece más difícil y por qué?",
            "¿Qué comando del bot usarías más seguido?",
            "¿Qué error te daría más pena mostrar en clase?",
            "¿Qué integración te parece más útil: Calendar, GitHub o YouTube?",
            "¿Qué guardarías en la base de datos para mejorar la experiencia del usuario?"
    };

    private static final String[] RETOS = {
            "Explica en una frase para qué sirve OAuth en tu bot.",
            "Escribe un ejemplo de dato que guardarías en la tabla usuarios.",
            "Di una mejora que harías al menú del bot.",
            "Propón un nombre para un nuevo comando del bot.",
            "Resume el proyecto como si se lo contaras al profesor en 20 segundos."
    };

    private static final String[] HISTORIAS = {
            "Un usuario entró al portal, autorizó Calendar y al minuto el bot le recordó entregar el informe. Ese día el caos perdió.",
            "El admin abrió el panel, vio usuarios verificados y detectó quién faltaba por conectar GitHub. El sistema hizo visible lo pendiente.",
            "Un equipo creó una competencia de parejas en clase. Entre preguntas y puntos, terminaron aprendiendo el flujo del bot sin darse cuenta."
    };

    private static final String[] PALABRAS_AHORCADO = {
            "telegram", "calendario", "github", "youtube", "railway", "neon", "usuario", "comando", "permiso", "bot"
    };

    private static final String[] MISIONES = {
            "Crear un caso de uso nuevo para una función del bot.",
            "Probar tres comandos y anotar qué respondió el bot.",
            "Escribir qué datos se guardarían en la base de datos al usar Calendar.",
            "Revisar si el menú del bot explica bien los comandos.",
            "Pensar una mejora para el módulo administrador."
    };

    private static final PreguntaTrivia[] TRIVIAS = {
            new PreguntaTrivia("¿Cuál es el planeta más grande del sistema solar?", "Saturno", "Júpiter", "Neptuno", 'b'),
            new PreguntaTrivia("¿Cuántos lados tiene un hexágono?", "5", "6", "7", 'b'),
            new PreguntaTrivia("¿Quién escribió \"Cien años de soledad\"?", "Gabriel García Márquez", "Mario Vargas Llosa", "Julio Cortázar", 'a'),
            new PreguntaTrivia("¿Cuál es el océano más grande?", "Atlántico", "Índico", "Pacífico", 'c'),
            new PreguntaTrivia("¿Cuál es la capital de Perú?", "Quito", "Lima", "Bogotá", 'b'),
            new PreguntaTrivia("¿Cuánto es 12 x 12?", "124", "144", "132", 'b'),
            new PreguntaTrivia("¿Qué gas absorben las plantas para hacer fotosíntesis?", "Oxígeno", "Nitrógeno", "Dióxido de carbono", 'c'),
            new PreguntaTrivia("¿Qué elemento químico tiene el símbolo \"Au\"?", "Plata", "Oro", "Aluminio", 'b')
    };

    private static final PreguntaAbierta[] PREGUNTAS_PAREJAS = {
            new PreguntaAbierta("¿Qué plataforma se usará para alojar el bot?", "railway"),
            new PreguntaAbierta("¿Qué base de datos se propuso para guardar información?", "neon"),
            new PreguntaAbierta("¿Qué red social usa canales y videos que el bot puede consultar?", "youtube"),
            new PreguntaAbierta("¿Qué servicio permite revisar commits y cambios pendientes?", "github"),
            new PreguntaAbierta("¿Qué app sirve para programar eventos y recordatorios?", "calendario"),
            new PreguntaAbierta("¿Qué mecanismo permite autorizar aplicaciones sin compartir contraseña?", "oauth")
    };

    @Override
    public String getBotUsername() {
        return BOT_USERNAME;
    }

    @Override
    public String getBotToken() {
        return BOT_TOKEN;
    }

    @Override
    public void onUpdateReceived(Update update) {
        if (!update.hasMessage() || !update.getMessage().hasText()) return;

        long chatId = update.getMessage().getChatId();
        long userId = update.getMessage().getFrom() == null ? chatId : update.getMessage().getFrom().getId();
        String nombre = nombreUsuario(update);
        String mensaje = update.getMessage().getText();
        String texto = mensaje.trim().toLowerCase(Locale.ROOT);

        System.out.println("Mensaje recibido de " + chatId + ": " + mensaje);

        String respuesta;
        try {
            respuesta = procesar(chatId, userId, nombre, texto, mensaje.trim());
        } catch (Exception e) {
            System.out.println("Error procesando el mensaje: " + e);
            respuesta = "Ups, algo salió mal. Intenta de nuevo.";
        }

        enviarTexto(chatId, respuesta);
    }

    private String procesar(long chatId, long userId, String nombre, String texto, String mensajeOriginal) {
        if (texto.startsWith("/start auth_")) {
            return autorizarDesdeTelegram(chatId, texto);
        }

        if (triviaActiva.containsKey(chatId) && texto.length() == 1 && "abc".contains(texto)) {
            return responderTrivia(chatId, userId, texto.charAt(0));
        }
        if (adivinaActiva.containsKey(chatId) && esNumero(texto)) {
            return responderAdivina(chatId, userId, texto);
        }
        if (ahorcadoActivo.containsKey(chatId) && texto.length() == 1 && Character.isLetter(texto.charAt(0))) {
            return responderAhorcado(chatId, userId, texto);
        }
        if (competencias.containsKey(chatId) && !texto.startsWith("/")) {
            return responderCompetencia(chatId, mensajeOriginal);
        }

        switch (texto) {
            case "/start":
                return saludo(nombre);
            case "/menu":
            case "/ayuda":
            case "/help":
                return menu();
            case "/juegos":
                return menuJuegos();
            case "/integraciones":
                return menuIntegraciones();
            case "/portal":
            case "/autorizar":
                return portalAutorizacion(chatId);
            case "/permisos":
                return verPermisos(chatId);
            case "/dado":
                return tirarDado();
            case "/moneda":
                return lanzarMoneda();
            case "/chiste":
                return aleatorio(CHISTES);
            case "/fact":
                return "📌 " + aleatorio(FACTS);
            case "/consejo":
                return "💡 " + aleatorio(CONSEJOS);
            case "/frase":
                return "✨ " + aleatorio(FRASES);
            case "/prediccion":
                return "🔮 " + aleatorio(PREDICCIONES);
            case "/historia":
                return "📖 " + aleatorio(HISTORIAS);
            case "/trivia":
                return nuevaTrivia(chatId);
            case "/score":
                return verScore(chatId, userId);
            case "/hora":
                return horaActual();
            case "/limpiar":
                memoria.remove(chatId);
                return "🧹 Listo, borré mi memoria de esta conversación.";
            case "/verdad":
                return "🎤 Verdad:\n" + aleatorio(VERDADES);
            case "/reto":
                return "⚡ Reto:\n" + aleatorio(RETOS);
            case "/mision":
                return misionDiaria(chatId, userId, false);
            case "/mision completar":
                return misionDiaria(chatId, userId, true);
        }

        if (texto.startsWith("/pares")) return sumaPares(texto);
        if (texto.startsWith("/primo")) return sumaPrima(texto);
        if (texto.startsWith("/ppt")) return piedraPapelTijera(chatId, userId, texto);
        if (texto.startsWith("/azar")) return numeroAzar(texto);
        if (texto.startsWith("/eco")) return eco(mensajeOriginal);
        if (texto.startsWith("/traduce")) return traducir(chatId, mensajeOriginal);
        if (texto.startsWith("/8ball")) return bolaOcho(mensajeOriginal);
        if (texto.startsWith("/ruleta")) return ruleta(mensajeOriginal);
        if (texto.startsWith("/pareja")) return pareja(mensajeOriginal);
        if (texto.startsWith("/top")) return top(mensajeOriginal);
        if (texto.startsWith("/ship")) return ship(mensajeOriginal);
        if (texto.startsWith("/piropo")) return piropo(mensajeOriginal);
        if (texto.startsWith("/adivina")) return iniciarOResponderAdivina(chatId, userId, texto);
        if (texto.startsWith("/ahorcado")) return iniciarAhorcado(chatId);
        if (texto.startsWith("/letra")) return letraAhorcado(chatId, userId, texto);
        if (texto.startsWith("/concurso")) return concurso(chatId);
        if (texto.startsWith("/parejas")) return competenciaParejas(chatId, texto, mensajeOriginal);
        if (texto.startsWith("/github")) return github(mensajeOriginal);
        if (texto.startsWith("/youtube")) return youtube(mensajeOriginal);
        if (texto.startsWith("/calendar") || texto.startsWith("/calendario")) return calendario(chatId, mensajeOriginal);
        if (texto.startsWith("/guardar")) return guardarDemo(chatId, mensajeOriginal);
        if (texto.startsWith("/autorizar_demo")) return autorizarDemo(chatId, texto);

        mostrarEscribiendo(chatId);
        return hablarConGroq(chatId, mensajeOriginal);
    }

    private String saludo(String nombre) {
        return "¡Hola, " + nombre + "! Soy tu bot de Telegram.\n"
                + "Puedo conversar con IA, jugar, revisar integraciones y ayudarte con Calendar, GitHub y YouTube.\n"
                + "Escribe /menu para ver todo.";
    }

    private String menu() {
        return "🤖 MENÚ PRINCIPAL\n\n"
                + "🎮 Juegos: /juegos\n"
                + "🔐 Portal y permisos: /portal, /permisos\n"
                + "🔌 Integraciones: /integraciones\n"
                + "🧠 IA: escríbeme cualquier pregunta\n\n"
                + "Comandos rápidos:\n"
                + "/trivia, /ahorcado, /adivina, /ppt piedra, /8ball pregunta\n"
                + "/calendar evento | 2026-09-10 15:00 | Entrega del proyecto\n"
                + "/github usuario/repositorio\n"
                + "/youtube busqueda\n"
                + "/guardar tipo | dato | descripcion";
    }

    private String menuJuegos() {
        return "🎮 JUEGOS Y DINÁMICAS\n\n"
                + "/trivia - Pregunta con opciones a, b, c\n"
                + "/ahorcado - Adivina una palabra letra por letra\n"
                + "/adivina - Adivina un número del 1 al 50\n"
                + "/ppt piedra|papel|tijera - Juego clásico contra el bot\n"
                + "/dado - Lanza un dado\n"
                + "/moneda - Cara o sello\n"
                + "/8ball <pregunta> - Bola mágica\n"
                + "/ruleta Ana | Luis | Sofía - Elige una opción al azar\n"
                + "/pareja Ana | Luis | Sofía - Forma una pareja aleatoria\n"
                + "/ship Ana | Luis - Calcula compatibilidad divertida\n"
                + "/top tema | Ana | Luis | Sofía - Ranking aleatorio\n"
                + "/verdad - Pregunta segura\n"
                + "/reto - Reto seguro\n"
                + "/mision - Misión diaria\n"
                + "/concurso - Trivia rápida\n"
                + "/parejas iniciar Ana+Luis | Sofía+Carlos - Competencia por parejas";
    }

    private String menuIntegraciones() {
        return "🔌 INTEGRACIONES DEL PROYECTO\n\n"
                + "/portal - Link de la página para verificar Telegram y autorizar apps\n"
                + "/permisos - Ver permisos conectados en esta demo\n"
                + "/github usuario/repositorio - Revisa datos públicos del repo\n"
                + "/youtube tema - Busca videos si configuras YOUTUBE_API_KEY\n"
                + "/calendar evento | fecha hora | titulo - Simula/agenda un evento\n"
                + "/guardar tipo | dato | descripcion - Simula información guardada en BD\n\n"
                + "Para demo sin credenciales, el bot responde en modo simulado. Con tokens reales se conecta por API.";
    }

    private String portalAutorizacion(long chatId) {
        String enlace = APP_BASE_URL + "/autorizar?telegramChatId=" + chatId;
        return "🔐 Portal de autorización\n\n"
                + "Desde esta página el usuario verificaría su número/cuenta de Telegram y daría permiso a Calendar, GitHub y YouTube:\n"
                + enlace + "\n\n"
                + "Demo rápida dentro del bot:\n"
                + "/autorizar_demo calendar\n"
                + "/autorizar_demo github\n"
                + "/autorizar_demo youtube\n\n"
                + "En producción, esta página guardaría en Neon el usuario, permisos, tokens cifrados y fecha de autorización.";
    }

    private String autorizarDemo(long chatId, String texto) {
        String app = argumento(texto);
        if (app == null) return "Uso: /autorizar_demo calendar|github|youtube";
        app = normalizar(app);
        if (!List.of("calendar", "calendario", "github", "youtube").contains(app)) {
            return "Solo puedo autorizar en demo: calendar, github o youtube.";
        }
        if (app.equals("calendario")) app = "calendar";
        permisosDemo.computeIfAbsent(chatId, k -> new LinkedHashSet<>()).add(app);
        return "✅ Permiso demo guardado: " + app + "\n"
                + "BD: usuarios + integraciones + tokens_autorizacion + logs.";
    }

    private String autorizarDesdeTelegram(long chatId, String texto) {
        String app = texto.replace("/start auth_", "").trim();
        return autorizarDemo(chatId, "/autorizar_demo " + app);
    }

    private String verPermisos(long chatId) {
        Set<String> permisos = permisosDemo.getOrDefault(chatId, new LinkedHashSet<>());
        if (permisos.isEmpty()) {
            return "🔐 Este chat todavía no tiene permisos demo.\nUsa /portal o /autorizar_demo calendar.";
        }
        return "🔐 Permisos demo activos: " + String.join(", ", permisos);
    }

    private String tirarDado() {
        int dado = ThreadLocalRandom.current().nextInt(1, 7);
        return "🎲 El dado cayó en el número: " + dado;
    }

    private String lanzarMoneda() {
        return Math.random() < 0.5 ? "🪙 Salió CARA" : "🪙 Salió SELLO";
    }

    private String horaActual() {
        DateTimeFormatter formato = DateTimeFormatter
                .ofPattern("EEEE d 'de' MMMM 'de' yyyy, hh:mm a", Locale.forLanguageTag("es"));
        return "🕒 Ahora mismo es: " + LocalDateTime.now().format(formato);
    }

    private String eco(String comando) {
        String texto = argumento(comando);
        if (texto == null) return "Uso correcto: /eco hola mundo";
        return "🔁 " + texto;
    }

    private String numeroAzar(String comando) {
        String arg = argumento(comando);
        if (arg == null) return "Uso correcto: /azar 1 100";
        String[] partes = arg.split("\\s+");
        if (partes.length != 2) return "Uso correcto: /azar 1 100";
        try {
            int min = Integer.parseInt(partes[0]);
            int max = Integer.parseInt(partes[1]);
            if (min > max) return "El mínimo no puede ser mayor que el máximo.";
            return "🎯 Tu número entre " + min + " y " + max + " es: "
                    + ThreadLocalRandom.current().nextInt(min, max + 1);
        } catch (NumberFormatException e) {
            return "Uso correcto: /azar 1 100";
        }
    }

    private String sumaPares(String comando) {
        Integer num = extraerNumero(comando);
        if (num == null) return "Uso correcto: /pares 254";
        int suma = 0;
        for (char c : String.valueOf(Math.abs(num)).toCharArray()) {
            int digito = c - '0';
            if (digito % 2 == 0) suma += digito;
        }
        return "La suma de los dígitos pares de " + num + " es: " + suma;
    }

    private String sumaPrima(String comando) {
        Integer num = extraerNumero(comando);
        if (num == null) return "Uso correcto: /primo 14";
        int suma = 0;
        for (char c : String.valueOf(Math.abs(num)).toCharArray()) {
            suma += c - '0';
        }
        return "La suma de sus dígitos es " + suma + " y "
                + (esPrimo(suma) ? "SÍ" : "NO") + " es un número primo.";
    }

    private String nuevaTrivia(long chatId) {
        PreguntaTrivia pregunta = TRIVIAS[ThreadLocalRandom.current().nextInt(TRIVIAS.length)];
        triviaActiva.put(chatId, pregunta);
        return "🧠 TRIVIA\n\n"
                + pregunta.pregunta + "\n\n"
                + "A) " + pregunta.opciones[0] + "\n"
                + "B) " + pregunta.opciones[1] + "\n"
                + "C) " + pregunta.opciones[2] + "\n\n"
                + "Responde con una letra: a, b o c";
    }

    private String responderTrivia(long chatId, long userId, char letra) {
        PreguntaTrivia activa = triviaActiva.get(chatId);
        if (letra == activa.letraCorrecta) {
            triviaActiva.remove(chatId);
            int total = sumarPuntos(chatId, userId, 1);
            return "✅ ¡Correcto!\nGanaste 1 punto. Total: " + total + "\nEscribe /trivia para otra ronda.";
        }
        return "❌ Esa no es. Intenta otra vez con a, b o c.";
    }

    private String verScore(long chatId, long userId) {
        int puntos = puntajes.getOrDefault(claveUsuario(chatId, userId), 0);
        if (puntos == 0) return "🏆 Todavía no tienes puntos.\nPrueba /trivia, /adivina, /ahorcado o /concurso.";
        return "🏆 Llevas " + puntos + (puntos == 1 ? " punto." : " puntos.");
    }

    private String piedraPapelTijera(long chatId, long userId, String comando) {
        String eleccionUsuario = argumento(comando);
        if (eleccionUsuario == null) return "Uso correcto: /ppt piedra";
        String[] opciones = {"piedra", "papel", "tijera"};
        String[] emojis = {"✊", "✋", "✌️"};
        int indiceUsuario = Arrays.asList(opciones).indexOf(eleccionUsuario);
        if (indiceUsuario == -1) return "Uso correcto: /ppt piedra, /ppt papel o /ppt tijera";
        int indiceBot = ThreadLocalRandom.current().nextInt(opciones.length);
        String jugada = "Tú: " + emojis[indiceUsuario] + "  vs  Yo: " + emojis[indiceBot] + "\n\n";
        if (indiceUsuario == indiceBot) return jugada + "🤝 ¡Empate!";
        if ((indiceUsuario - indiceBot + 3) % 3 == 1) {
            int total = sumarPuntos(chatId, userId, 1);
            return jugada + "🎉 ¡Ganaste tú! +1 punto. Total: " + total;
        }
        return jugada + "🤖 ¡Gané yo!";
    }

    private String bolaOcho(String comando) {
        String pregunta = argumento(comando);
        if (pregunta == null) return "Uso correcto: /8ball ¿termino el proyecto hoy?";
        String[] respuestas = {
                "Sí, totalmente.", "Probablemente sí.", "Mejor revisa otra vez.",
                "No lo veo claro.", "Pregunta después de compilar.", "Con café y orden, sí."
        };
        return "🎱 " + aleatorio(respuestas);
    }

    private String ruleta(String comando) {
        List<String> opciones = listaArgumentos(argumento(comando));
        if (opciones.size() < 2) return "Uso: /ruleta opción 1 | opción 2 | opción 3";
        return "🎡 La ruleta eligió: " + aleatorio(opciones);
    }

    private String pareja(String comando) {
        List<String> nombres = listaArgumentos(argumento(comando));
        if (nombres.size() < 2) return "Uso: /pareja Ana | Luis | Sofía";
        String a = sacarAleatorio(nombres);
        String b = sacarAleatorio(nombres);
        return "💞 Pareja formada: " + a + " + " + b;
    }

    private String ship(String comando) {
        List<String> nombres = listaArgumentos(argumento(comando));
        if (nombres.size() < 2) {
            String arg = argumento(comando);
            if (arg != null) nombres = new ArrayList<>(Arrays.asList(arg.split("\\s+")));
        }
        if (nombres.size() < 2) return "Uso: /ship Ana | Luis";
        String a = nombres.get(0).trim();
        String b = nombres.get(1).trim();
        int porcentaje = Math.abs((normalizar(a) + normalizar(b)).hashCode()) % 101;
        return "💘 Compatibilidad de " + a + " y " + b + ": " + porcentaje + "%\n"
                + (porcentaje >= 80 ? "Nivel proyecto final bien sustentado." :
                porcentaje >= 50 ? "Hay potencial, falta documentación." :
                "Necesitan más commits juntos.");
    }

    private String top(String comando) {
        String arg = argumento(comando);
        if (arg == null) return "Uso: /top tema | Ana | Luis | Sofía";
        List<String> partes = listaArgumentos(arg);
        if (partes.size() < 3) return "Uso: /top tema | Ana | Luis | Sofía";
        String tema = partes.remove(0);
        StringBuilder sb = new StringBuilder("🏅 TOP: ").append(tema).append("\n\n");
        int limite = Math.min(5, partes.size());
        for (int i = 1; i <= limite; i++) {
            sb.append(i).append(". ").append(sacarAleatorio(partes)).append("\n");
        }
        return sb.toString().trim();
    }

    private String piropo(String comando) {
        String persona = argumento(comando);
        if (persona == null) return "💬 " + aleatorio(PIROPOS);
        return "💬 " + persona + ", " + aleatorio(PIROPOS).toLowerCase(Locale.ROOT);
    }

    private String iniciarOResponderAdivina(long chatId, long userId, String texto) {
        String arg = argumento(texto);
        if (arg == null) {
            int secreto = ThreadLocalRandom.current().nextInt(1, 51);
            adivinaActiva.put(chatId, new AdivinaEstado(secreto));
            return "🔢 ADIVINA\nEstoy pensando en un número del 1 al 50.\nResponde con un número.";
        }
        if (!adivinaActiva.containsKey(chatId)) {
            adivinaActiva.put(chatId, new AdivinaEstado(ThreadLocalRandom.current().nextInt(1, 51)));
        }
        return responderAdivina(chatId, userId, arg);
    }

    private String responderAdivina(long chatId, long userId, String texto) {
        AdivinaEstado estado = adivinaActiva.get(chatId);
        try {
            int intento = Integer.parseInt(texto.trim());
            estado.intentos++;
            if (intento == estado.secreto) {
                adivinaActiva.remove(chatId);
                int puntosGanados = Math.max(1, 6 - estado.intentos);
                int total = sumarPuntos(chatId, userId, puntosGanados);
                return "✅ ¡Correcto! Era " + estado.secreto + ".\n"
                        + "Intentos: " + estado.intentos + ". Ganaste " + puntosGanados + " puntos. Total: " + total;
            }
            if (estado.intentos >= 6) {
                adivinaActiva.remove(chatId);
                return "❌ Se acabaron los intentos. El número era " + estado.secreto + ".";
            }
            return intento < estado.secreto ? "📈 Es más alto." : "📉 Es más bajo.";
        } catch (NumberFormatException e) {
            return "Responde con un número del 1 al 50.";
        }
    }

    private String iniciarAhorcado(long chatId) {
        String palabra = PALABRAS_AHORCADO[ThreadLocalRandom.current().nextInt(PALABRAS_AHORCADO.length)];
        AhorcadoEstado estado = new AhorcadoEstado(palabra);
        ahorcadoActivo.put(chatId, estado);
        return "🪢 AHORCADO\nPalabra: " + estado.palabraVisible() + "\n"
                + "Tienes " + estado.vidas + " vidas. Envía una letra o usa /letra a.";
    }

    private String letraAhorcado(long chatId, long userId, String texto) {
        String letra = argumento(texto);
        if (letra == null || letra.length() != 1) return "Uso: /letra a";
        if (!ahorcadoActivo.containsKey(chatId)) return "Primero inicia una partida con /ahorcado.";
        return responderAhorcado(chatId, userId, letra);
    }

    private String responderAhorcado(long chatId, long userId, String letraTexto) {
        AhorcadoEstado estado = ahorcadoActivo.get(chatId);
        char letra = normalizar(letraTexto).charAt(0);
        if (estado.letras.contains(letra)) return "Ya probaste esa letra.\nPalabra: " + estado.palabraVisible();
        estado.letras.add(letra);
        if (estado.palabra.indexOf(letra) < 0) estado.vidas--;
        if (estado.ganado()) {
            ahorcadoActivo.remove(chatId);
            int total = sumarPuntos(chatId, userId, 4);
            return "✅ ¡Ganaste ahorcado! La palabra era " + estado.palabra + ".\n+4 puntos. Total: " + total;
        }
        if (estado.vidas <= 0) {
            ahorcadoActivo.remove(chatId);
            return "❌ Perdiste. La palabra era " + estado.palabra + ".";
        }
        return "Palabra: " + estado.palabraVisible() + "\nVidas: " + estado.vidas
                + "\nLetras usadas: " + estado.letras;
    }

    private String concurso(long chatId) {
        PreguntaTrivia pregunta = TRIVIAS[ThreadLocalRandom.current().nextInt(TRIVIAS.length)];
        triviaActiva.put(chatId, pregunta);
        return "🏁 CONCURSO RÁPIDO\nVale 1 punto como trivia.\n\n"
                + pregunta.pregunta + "\n"
                + "A) " + pregunta.opciones[0] + "\n"
                + "B) " + pregunta.opciones[1] + "\n"
                + "C) " + pregunta.opciones[2] + "\n\n"
                + "Responde con a, b o c.";
    }

    private String misionDiaria(long chatId, long userId, boolean completar) {
        String clave = claveUsuario(chatId, userId);
        LocalDate hoy = LocalDate.now();
        MisionDiaria actual = misiones.get(clave);
        if (actual == null || !actual.fecha.equals(hoy)) {
            String texto = MISIONES[Math.abs((clave + hoy).hashCode()) % MISIONES.length];
            actual = new MisionDiaria(hoy, texto);
            misiones.put(clave, actual);
        }
        if (completar) {
            if (actual.completada) return "📅 Esa misión ya estaba completada hoy.";
            actual.completada = true;
            int total = sumarPuntos(chatId, userId, 3);
            return "✅ Misión completada. +3 puntos. Total: " + total;
        }
        return "📅 Misión de hoy:\n" + actual.texto + "\nEstado: "
                + (actual.completada ? "completada" : "pendiente")
                + "\nPara marcarla: /mision completar";
    }

    private String competenciaParejas(long chatId, String texto, String original) {
        if (texto.equals("/parejas estado")) return estadoCompetencia(chatId);
        if (texto.equals("/parejas siguiente")) return siguientePreguntaParejas(chatId);
        if (texto.equals("/parejas saltar")) return saltarPareja(chatId);
        if (texto.equals("/parejas finalizar")) return finalizarCompetencia(chatId);

        String arg = argumento(original);
        if (arg == null || !texto.startsWith("/parejas iniciar")) {
            return "Uso competencia de parejas:\n"
                    + "/parejas iniciar Ana+Luis | Sofía+Carlos\n"
                    + "/parejas siguiente\n"
                    + "/parejas estado\n"
                    + "/parejas finalizar";
        }
        arg = arg.replaceFirst("(?i)^iniciar", "").trim();
        List<String> parejasTexto = listaArgumentos(arg);
        if (parejasTexto.size() < 2) return "Necesito mínimo dos parejas. Ejemplo: /parejas iniciar Ana+Luis | Sofía+Carlos";

        CompetenciaParejas comp = new CompetenciaParejas();
        for (String p : parejasTexto) {
            String[] nombres = p.split("\\+");
            if (nombres.length != 2) return "Cada pareja debe ir como Nombre+Nombre. Ejemplo: Ana+Luis";
            comp.parejas.add(new ParejaPuntaje(nombres[0].trim(), nombres[1].trim()));
        }
        competencias.put(chatId, comp);
        return "🏆 Competencia de parejas creada con " + comp.parejas.size() + " parejas.\n"
                + "Usa /parejas siguiente para lanzar la primera pregunta.";
    }

    private String siguientePreguntaParejas(long chatId) {
        CompetenciaParejas comp = competencias.get(chatId);
        if (comp == null) return "No hay competencia activa. Usa /parejas iniciar Ana+Luis | Sofía+Carlos";
        comp.indicePareja = (comp.indicePareja + 1) % comp.parejas.size();
        comp.preguntaActual = PREGUNTAS_PAREJAS[ThreadLocalRandom.current().nextInt(PREGUNTAS_PAREJAS.length)];
        ParejaPuntaje pareja = comp.parejas.get(comp.indicePareja);
        return "👥 Turno de " + pareja.nombre() + "\n\n"
                + comp.preguntaActual.pregunta + "\n"
                + "Respondan escribiendo la respuesta. Correcto +5, incorrecto -3.";
    }

    private String responderCompetencia(long chatId, String respuesta) {
        CompetenciaParejas comp = competencias.get(chatId);
        if (comp.preguntaActual == null) return "Usa /parejas siguiente para lanzar una pregunta.";
        ParejaPuntaje pareja = comp.parejas.get(comp.indicePareja);
        String respuestaCorrecta = comp.preguntaActual.respuesta;
        boolean correcta = normalizar(respuesta).contains(normalizar(respuestaCorrecta));
        comp.preguntaActual = null;
        if (correcta) {
            pareja.puntos += 5;
            return "✅ Correcto. " + pareja.nombre() + " suma 5 puntos.\n" + estadoCompetencia(chatId)
                    + "\nUsa /parejas siguiente.";
        }
        pareja.puntos -= 3;
        return "❌ Incorrecto. Respuesta esperada: " + respuestaCorrecta
                + "\n" + pareja.nombre() + " pierde 3 puntos.\n" + estadoCompetencia(chatId)
                + "\nUsa /parejas siguiente.";
    }

    private String saltarPareja(long chatId) {
        CompetenciaParejas comp = competencias.get(chatId);
        if (comp == null || comp.preguntaActual == null) return "No hay pregunta activa para saltar.";
        ParejaPuntaje pareja = comp.parejas.get(comp.indicePareja);
        pareja.puntos -= 3;
        comp.preguntaActual = null;
        return "⏭ Turno saltado. " + pareja.nombre() + " pierde 3 puntos.\n" + estadoCompetencia(chatId);
    }

    private String estadoCompetencia(long chatId) {
        CompetenciaParejas comp = competencias.get(chatId);
        if (comp == null) return "No hay competencia activa.";
        StringBuilder sb = new StringBuilder("📊 Marcador de parejas:\n");
        comp.parejas.stream()
                .sorted((a, b) -> Integer.compare(b.puntos, a.puntos))
                .forEach(p -> sb.append("- ").append(p.nombre()).append(": ").append(p.puntos).append(" pts\n"));
        return sb.toString().trim();
    }

    private String finalizarCompetencia(long chatId) {
        CompetenciaParejas comp = competencias.remove(chatId);
        if (comp == null) return "No hay competencia activa.";
        ParejaPuntaje ganadora = comp.parejas.stream()
                .max((a, b) -> Integer.compare(a.puntos, b.puntos))
                .orElse(null);
        return "🏁 Competencia finalizada.\nGanadores: "
                + (ganadora == null ? "sin ganador" : ganadora.nombre() + " con " + ganadora.puntos + " puntos.");
    }

    private String github(String comando) {
        String repo = argumento(comando);
        if (repo == null || !repo.contains("/")) return "Uso: /github usuario/repositorio";
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.github.com/repos/" + repo))
                    .timeout(Duration.ofSeconds(15))
                    .GET();
            if (GITHUB_TOKEN != null && !GITHUB_TOKEN.isBlank()) {
                builder.header("Authorization", "Bearer " + GITHUB_TOKEN);
            }
            HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return "GitHub respondió " + response.statusCode()
                        + ". Revisa que el repo exista o configura GITHUB_TOKEN si es privado.";
            }
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            return "🐙 GitHub: " + json.get("full_name").getAsString() + "\n"
                    + "Descripción: " + textoJson(json, "description", "Sin descripción") + "\n"
                    + "Stars: " + json.get("stargazers_count").getAsInt() + "\n"
                    + "Forks: " + json.get("forks_count").getAsInt() + "\n"
                    + "Issues abiertas: " + json.get("open_issues_count").getAsInt() + "\n"
                    + "Última actualización: " + textoJson(json, "updated_at", "sin dato") + "\n\n"
                    + "BD: se guardaría repo, usuario, fecha de consulta y resultado.";
        } catch (Exception e) {
            System.out.println("Error GitHub: " + e.getMessage());
            return "No pude consultar GitHub ahora. En demo puedes explicar que aquí se revisan cambios pendientes del repo.";
        }
    }

    private String youtube(String comando) {
        String busqueda = argumento(comando);
        if (busqueda == null) return "Uso: /youtube música para estudiar";
        if (YOUTUBE_API_KEY == null || YOUTUBE_API_KEY.isBlank()) {
            return "▶️ YouTube modo demo\n"
                    + "Buscaría videos sobre: " + busqueda + "\n"
                    + "Para hacerlo real configura YOUTUBE_API_KEY.\n"
                    + "BD: se guardaría búsqueda, resultados seleccionados, usuario y fecha.";
        }
        try {
            String q = URLEncoder.encode(busqueda, StandardCharsets.UTF_8);
            URI uri = URI.create("https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&q="
                    + q + "&key=" + YOUTUBE_API_KEY);
            HttpResponse<String> response = http.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(15)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return "YouTube respondió " + response.statusCode() + ". Revisa la API key.";
            JsonArray items = JsonParser.parseString(response.body()).getAsJsonObject().getAsJsonArray("items");
            if (items.isEmpty()) return "No encontré videos para esa búsqueda.";
            StringBuilder sb = new StringBuilder("▶️ Resultados de YouTube:\n\n");
            for (JsonElement item : items) {
                JsonObject obj = item.getAsJsonObject();
                String id = obj.getAsJsonObject("id").get("videoId").getAsString();
                String titulo = obj.getAsJsonObject("snippet").get("title").getAsString();
                sb.append("- ").append(titulo).append("\n")
                        .append("https://www.youtube.com/watch?v=").append(id).append("\n");
            }
            return sb.toString().trim();
        } catch (Exception e) {
            System.out.println("Error YouTube: " + e.getMessage());
            return "No pude consultar YouTube ahora.";
        }
    }

    private String calendario(long chatId, String comando) {
        String arg = argumento(comando);
        if (arg == null) {
            return "Uso: /calendar evento | 2026-09-10 15:00 | Entrega del proyecto\n"
                    + "También sirve /calendario con el mismo formato.";
        }
        List<String> partes = listaArgumentos(arg);
        if (partes.size() < 3 || !normalizar(partes.get(0)).equals("evento")) {
            return "Uso: /calendar evento | 2026-09-10 15:00 | Entrega del proyecto";
        }
        permisosDemo.computeIfAbsent(chatId, k -> new LinkedHashSet<>()).add("calendar");
        return "📅 Evento preparado\n"
                + "Fecha/hora: " + partes.get(1) + "\n"
                + "Título: " + partes.get(2) + "\n\n"
                + "Modo demo: aquí se llamaría a Google Calendar API con el token autorizado en /portal.\n"
                + "BD: eventos_calendario guardaría usuario, título, fecha, estado y proveedor.";
    }

    private String guardarDemo(long chatId, String comando) {
        List<String> partes = listaArgumentos(argumento(comando));
        if (partes.size() < 3) return "Uso: /guardar tipo | dato | descripcion";
        return "💾 Registro preparado para base de datos\n"
                + "Chat ID: " + chatId + "\n"
                + "Tipo: " + partes.get(0) + "\n"
                + "Dato: " + partes.get(1) + "\n"
                + "Descripción: " + partes.get(2) + "\n\n"
                + "En Neon esto iría a una tabla según el módulo: usuarios, integraciones, eventos, repositorios, videos, juegos o logs.";
    }

    private String traducir(long chatId, String comando) {
        String frase = argumento(comando);
        if (frase == null) return "Uso correcto: /traduce hello world";

        JsonArray mensajes = new JsonArray();
        JsonObject sistema = new JsonObject();
        sistema.addProperty("role", "system");
        sistema.addProperty("content",
                "Detecta el idioma del texto del usuario. Si está en español, tradúcelo al inglés. "
                        + "Si está en cualquier otro idioma, tradúcelo al español. "
                        + "Responde únicamente con la traducción, sin explicaciones.");
        mensajes.add(sistema);

        JsonObject usuario = new JsonObject();
        usuario.addProperty("role", "user");
        usuario.addProperty("content", frase);
        mensajes.add(usuario);

        mostrarEscribiendo(chatId);
        try {
            return "🌍 " + pedirAGroq(mensajes);
        } catch (Exception e) {
            System.out.println("Error traduciendo: " + e.getMessage());
            return "No pude traducir eso. Intenta de nuevo.";
        }
    }

    private String hablarConGroq(long chatId, String pregunta) {
        if (GROQ_API_KEY == null || GROQ_API_KEY.isBlank()) {
            return "⚠️ Todavía no configuraste GROQ_API_KEY.\n"
                    + "Mientras tanto puedes usar /juegos, /integraciones, /github, /calendar y /youtube.";
        }

        List<JsonObject> historial = memoria.computeIfAbsent(chatId, k -> new ArrayList<>());
        JsonObject mensajeUsuario = new JsonObject();
        mensajeUsuario.addProperty("role", "user");
        mensajeUsuario.addProperty("content", pregunta);
        historial.add(mensajeUsuario);
        while (historial.size() > MAX_MENSAJES_MEMORIA) historial.remove(0);

        JsonArray mensajes = new JsonArray();
        JsonObject sistema = new JsonObject();
        sistema.addProperty("role", "system");
        sistema.addProperty("content",
                "Eres un bot de Telegram amigable llamado Botsito. Respondes corto, en español, "
                        + "con humor limpio, y ayudas con juegos, Calendar, GitHub, YouTube y tareas del proyecto.");
        mensajes.add(sistema);
        for (JsonObject m : historial) mensajes.add(m);

        try {
            String contenido = pedirAGroq(mensajes);
            JsonObject mensajeIA = new JsonObject();
            mensajeIA.addProperty("role", "assistant");
            mensajeIA.addProperty("content", contenido);
            historial.add(mensajeIA);
            return contenido;
        } catch (Exception e) {
            System.out.println("Error hablando con Groq: " + e.getMessage());
            return "Uy, mis neuronas fallaron un momento. Intenta de nuevo.";
        }
    }

    private String pedirAGroq(JsonArray mensajes) throws Exception {
        JsonObject cuerpo = new JsonObject();
        cuerpo.addProperty("model", MODELO_IA);
        cuerpo.add("messages", mensajes);
        cuerpo.addProperty("max_tokens", 500);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.groq.com/openai/v1/chat/completions"))
                .header("Authorization", "Bearer " + GROQ_API_KEY)
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(cuerpo.toString()))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            System.out.println("Groq respondió " + response.statusCode() + ": " + response.body());
            throw new IllegalStateException("Groq devolvió el código " + response.statusCode());
        }

        return JsonParser.parseString(response.body())
                .getAsJsonObject()
                .getAsJsonArray("choices")
                .get(0).getAsJsonObject()
                .getAsJsonObject("message")
                .get("content").getAsString();
    }

    private String argumento(String comando) {
        int espacio = comando.indexOf(' ');
        if (espacio == -1) return null;
        String resto = comando.substring(espacio + 1).trim();
        return resto.isEmpty() ? null : resto;
    }

    private Integer extraerNumero(String comando) {
        String arg = argumento(comando);
        if (arg == null) return null;
        try {
            return Integer.parseInt(arg);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean esPrimo(int n) {
        if (n <= 1) return false;
        for (int i = 2; (long) i * i <= n; i++) {
            if (n % i == 0) return false;
        }
        return true;
    }

    private boolean esNumero(String texto) {
        try {
            Integer.parseInt(texto);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private int sumarPuntos(long chatId, long userId, int puntosNuevos) {
        return puntajes.merge(claveUsuario(chatId, userId), puntosNuevos, Integer::sum);
    }

    private String claveUsuario(long chatId, long userId) {
        return chatId + ":" + userId;
    }

    private String aleatorio(String[] valores) {
        return valores[ThreadLocalRandom.current().nextInt(valores.length)];
    }

    private String aleatorio(List<String> valores) {
        return valores.get(ThreadLocalRandom.current().nextInt(valores.size()));
    }

    private String sacarAleatorio(List<String> valores) {
        return valores.remove(ThreadLocalRandom.current().nextInt(valores.size())).trim();
    }

    private List<String> listaArgumentos(String arg) {
        if (arg == null || arg.isBlank()) return new ArrayList<>();
        String[] partes = arg.contains("|") ? arg.split("\\|") : arg.split(",");
        List<String> limpias = new ArrayList<>();
        for (String parte : partes) {
            String limpia = parte.trim();
            if (!limpia.isEmpty()) limpias.add(limpia);
        }
        return limpias;
    }

    private String normalizar(String texto) {
        String limpio = Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return limpio.toLowerCase(Locale.ROOT).trim();
    }

    private String textoJson(JsonObject obj, String campo, String defecto) {
        JsonElement valor = obj.get(campo);
        if (valor == null || valor.isJsonNull()) return defecto;
        return valor.getAsString();
    }

    private String nombreUsuario(Update update) {
        if (update.getMessage().getFrom() == null) return "usuario";
        String username = update.getMessage().getFrom().getUserName();
        if (username != null && !username.isBlank()) return "@" + username;
        String firstName = update.getMessage().getFrom().getFirstName();
        return firstName == null || firstName.isBlank() ? "usuario" : firstName;
    }

    private void enviarTexto(long chatId, String texto) {
        try {
            SendMessage mensaje = new SendMessage(String.valueOf(chatId), texto);
            mensaje.enableMarkdown(false);
            execute(mensaje);
        } catch (TelegramApiException e) {
            System.out.println("No pude enviar el mensaje: " + e.getMessage());
        }
    }

    private void mostrarEscribiendo(long chatId) {
        try {
            SendChatAction accion = new SendChatAction();
            accion.setChatId(String.valueOf(chatId));
            accion.setAction(ActionType.TYPING);
            execute(accion);
        } catch (TelegramApiException ignored) {
        }
    }

    private static class PreguntaTrivia {
        final String pregunta;
        final String[] opciones;
        final char letraCorrecta;

        PreguntaTrivia(String pregunta, String a, String b, String c, char letraCorrecta) {
            this.pregunta = pregunta;
            this.opciones = new String[]{a, b, c};
            this.letraCorrecta = letraCorrecta;
        }
    }

    private static class PreguntaAbierta {
        final String pregunta;
        final String respuesta;

        PreguntaAbierta(String pregunta, String respuesta) {
            this.pregunta = pregunta;
            this.respuesta = respuesta;
        }
    }

    private static class AdivinaEstado {
        final int secreto;
        int intentos = 0;

        AdivinaEstado(int secreto) {
            this.secreto = secreto;
        }
    }

    private static class AhorcadoEstado {
        final String palabra;
        int vidas = 6;
        final Set<Character> letras = new LinkedHashSet<>();

        AhorcadoEstado(String palabra) {
            this.palabra = palabra;
        }

        String palabraVisible() {
            StringJoiner joiner = new StringJoiner(" ");
            for (char c : palabra.toCharArray()) {
                joiner.add(letras.contains(c) ? String.valueOf(c) : "_");
            }
            return joiner.toString();
        }

        boolean ganado() {
            for (char c : palabra.toCharArray()) {
                if (!letras.contains(c)) return false;
            }
            return true;
        }
    }

    private static class MisionDiaria {
        final LocalDate fecha;
        final String texto;
        boolean completada = false;

        MisionDiaria(LocalDate fecha, String texto) {
            this.fecha = fecha;
            this.texto = texto;
        }
    }

    private static class ParejaPuntaje {
        final String a;
        final String b;
        int puntos = 0;

        ParejaPuntaje(String a, String b) {
            this.a = a;
            this.b = b;
        }

        String nombre() {
            return a + " + " + b;
        }
    }

    private static class CompetenciaParejas {
        final List<ParejaPuntaje> parejas = new ArrayList<>();
        int indicePareja = -1;
        PreguntaAbierta preguntaActual;
    }
}
