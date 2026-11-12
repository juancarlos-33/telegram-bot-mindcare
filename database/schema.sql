-- =============================================================================
-- PROYECTO: Telegram Bot con Portal Web, Verificación e Integraciones
-- MOTOR: Neon PostgreSQL
-- DESPLIEGUE: Railway
-- DESCRIPCIÓN: Esquema completo de base de datos relacional para cumplir con
--              los requisitos funcionales RF-01 al RF-55 del documento oficial.
-- =============================================================================

-- Habilitar extensión para UUIDs nativos si no está habilitada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABLA: usuarios
-- Requisitos: RF-01, RF-02, RF-06, RF-12, RF-18, RF-41, RF-51
-- Permite reconocer al usuario en el portal web y en el bot de Telegram.
-- =============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    nombre_visible VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'administrador')),
    estado_verificacion VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (estado_verificacion IN ('pendiente', 'verificado', 'bloqueado')),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE usuarios IS 'Almacena usuarios verificados y no verificados con su identificador de Telegram.';
COMMENT ON COLUMN usuarios.id IS 'Identificador interno UUID único.';
COMMENT ON COLUMN usuarios.telegram_id IS 'ID de Telegram (BIGINT para soportar enteros de más de 32 bits).';
COMMENT ON COLUMN usuarios.rol IS 'Rol del usuario en el sistema: usuario regular o administrador (RF-06).';
COMMENT ON COLUMN usuarios.estado_verificacion IS 'Estado tras verificar en el portal web (RF-02, RF-12).';

-- =============================================================================
-- 2. TABLA: sesiones_verificacion
-- Requisitos: RF-02, RF-11, RF-12, RF-15
-- Gestiona el proceso seguro de verificación entre el portal web y Telegram.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sesiones_verificacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_verificacion VARCHAR(64) UNIQUE NOT NULL,
    token_sesion VARCHAR(128) UNIQUE,
    telegram_id_provisional BIGINT,
    completado BOOLEAN NOT NULL DEFAULT FALSE,
    expiracion TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sesiones_verificacion IS 'Sesiones temporales para enlace de verificación web -> Telegram.';

-- =============================================================================
-- 3. TABLA: integraciones
-- Requisitos: RF-03, RF-09, RF-13, RF-14, RF-26, RF-31, RF-42, RF-51
-- Guarda el estado de conexión de Google Calendar, GitHub y YouTube.
-- =============================================================================
CREATE TABLE IF NOT EXISTS integraciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    aplicacion VARCHAR(50) NOT NULL CHECK (aplicacion IN ('google_calendar', 'github', 'youtube')),
    estado_conexion VARCHAR(50) NOT NULL DEFAULT 'desconectado' CHECK (estado_conexion IN ('conectado', 'desconectado', 'pendiente', 'revocado', 'error')),
    fecha_autorizacion TIMESTAMPTZ,
    fecha_expiracion TIMESTAMPTZ,
    permisos_concedidos JSONB NOT NULL DEFAULT '[]'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usuario_aplicacion UNIQUE (usuario_id, aplicacion)
);

COMMENT ON TABLE integraciones IS 'Estado de conexión y permisos autorizados para servicios externos.';
COMMENT ON COLUMN integraciones.permisos_concedidos IS 'Lista de scopes/permisos aceptados por el usuario en formato JSON.';

-- =============================================================================
-- 4. TABLA: tokens
-- Requisitos: RF-07, RF-46, RF-51, Reglas de Almacenamiento Seguro
-- Tokens de OAuth cifrados en reposo (AES-256). Nunca almacenar en texto plano.
-- =============================================================================
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    servicio VARCHAR(50) NOT NULL CHECK (servicio IN ('google_calendar', 'github', 'youtube')),
    token_cifrado TEXT NOT NULL,
    refresh_token_cifrado TEXT,
    iv_cifrado VARCHAR(64),
    tipo_token VARCHAR(50) DEFAULT 'Bearer',
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usuario_servicio_token UNIQUE (usuario_id, servicio)
);

COMMENT ON TABLE tokens IS 'Tokens de acceso y refresco cifrados de servicios externos autorizados.';

-- =============================================================================
-- 5. TABLA: preferencias
-- Requisitos: RF-10, RF-43, RF-51
-- Idioma, zona horaria, repositorio predeterminado y configuraciones de respuesta.
-- =============================================================================
CREATE TABLE IF NOT EXISTS preferencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    idioma VARCHAR(10) NOT NULL DEFAULT 'es',
    zona_horaria VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
    repositorio_predeterminado VARCHAR(255),
    calendario_predeterminado VARCHAR(255) DEFAULT 'primary',
    preferencias_respuesta JSONB NOT NULL DEFAULT '{"modo": "breve", "tono": "amigable", "formato": "markdown"}'::jsonb,
    opciones_privacidad JSONB NOT NULL DEFAULT '{"guardar_memoria": true, "permitir_logs": true}'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE preferencias IS 'Preferencias de usuario para evitar ingresar los mismos datos repetidamente.';

-- =============================================================================
-- 6. TABLA: memoria
-- Requisitos: RF-22, RF-24, RF-43, RF-51
-- Memoria resumida de conversación con IA por usuario y chat.
-- =============================================================================
CREATE TABLE IF NOT EXISTS memoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    resumen_conversacion TEXT NOT NULL,
    ultimos_temas JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_interacciones INT NOT NULL DEFAULT 1,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usuario_chat_memoria UNIQUE (usuario_id, chat_id)
);

COMMENT ON TABLE memoria IS 'Resumen de conversación con IA para mantener contexto sin almacenar texto masivo.';

-- =============================================================================
-- 7. TABLA: eventos
-- Requisitos: RF-26, RF-28, RF-30, RF-51
-- Control de eventos consultados o creados desde el bot para Google Calendar.
-- =============================================================================
CREATE TABLE IF NOT EXISTS eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    id_evento_externo VARCHAR(255),
    titulo VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    descripcion TEXT,
    estado VARCHAR(50) NOT NULL DEFAULT 'creado' CHECK (estado IN ('creado', 'sincronizado', 'cancelado', 'pendiente')),
    enlace_evento TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE eventos IS 'Eventos creados o sincronizados con Google Calendar desde el bot.';

-- =============================================================================
-- 8. TABLA: github (consultas_github)
-- Requisitos: RF-31, RF-32, RF-33, RF-34, RF-35, RF-51
-- Historial de revisiones de issues, pull requests o commits para caché y auditoría.
-- =============================================================================
CREATE TABLE IF NOT EXISTS github (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    chat_id BIGINT NOT NULL,
    repositorio VARCHAR(255) NOT NULL,
    tipo_consulta VARCHAR(50) NOT NULL CHECK (tipo_consulta IN ('issues', 'pull_requests', 'commits', 'actividad', 'info_repo')),
    resultado_resumido JSONB NOT NULL,
    estado_consulta VARCHAR(50) NOT NULL CHECK (estado_consulta IN ('exitosa', 'sin_permiso', 'no_encontrado', 'error')),
    fecha_consulta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE github IS 'Historial y caché de consultas de GitHub (issues, PRs, commits).';

-- =============================================================================
-- 9. TABLA: youtube (consultas_youtube)
-- Requisitos: RF-36, RF-37, RF-38, RF-39, RF-40, RF-51
-- Registro de búsquedas de videos, reconocimiento de enlaces y control de cuota.
-- =============================================================================
CREATE TABLE IF NOT EXISTS youtube (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    chat_id BIGINT NOT NULL,
    tipo_solicitud VARCHAR(50) NOT NULL CHECK (tipo_solicitud IN ('busqueda', 'reconocimiento_enlace', 'canal')),
    termino_busqueda VARCHAR(255),
    url_video TEXT,
    titulo VARCHAR(255),
    canal VARCHAR(255),
    resultado_resumido JSONB,
    estado_consulta VARCHAR(50) NOT NULL CHECK (estado_consulta IN ('exitosa', 'cuota_agotada', 'no_encontrado', 'error')),
    fecha_consulta TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE youtube IS 'Historial de consultas, búsquedas y enlaces de YouTube procesados.';

-- =============================================================================
-- 10. TABLA: comandos
-- Requisitos: RF-16, RF-17, RF-19, RF-20, RF-51
-- Estadísticas, diagnóstico y registro de comandos ejecutados en Telegram.
-- =============================================================================
CREATE TABLE IF NOT EXISTS comandos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    chat_id BIGINT NOT NULL,
    comando VARCHAR(100) NOT NULL,
    parametros TEXT,
    resultado VARCHAR(50) NOT NULL CHECK (resultado IN ('exito', 'error', 'no_autorizado', 'desconocido')),
    mensaje_error TEXT,
    fecha_ejecucion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE comandos IS 'Registro de comandos ejecutados para estadísticas y diagnóstico.';

-- =============================================================================
-- 11. TABLA: puntajes
-- Requisitos: RF-19, RF-51
-- Puntuaciones de juegos: trivia, dado, moneda, hora, eco, piedra papel tijera.
-- =============================================================================
CREATE TABLE IF NOT EXISTS puntajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    juego VARCHAR(50) NOT NULL CHECK (juego IN ('trivia', 'dado', 'moneda', 'piedra_papel_tijera', 'eco', 'hora', 'otro')),
    puntaje_acumulado INT NOT NULL DEFAULT 0,
    partidas_jugadas INT NOT NULL DEFAULT 0,
    aciertos INT NOT NULL DEFAULT 0,
    ultima_participacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usuario_juego UNIQUE (usuario_id, juego)
);

COMMENT ON TABLE puntajes IS 'Puntuaciones acumuladas por usuario y tipo de juego interactivo.';

-- =============================================================================
-- 12. TABLA: logs
-- Requisitos: RF-08, RF-20, RF-25, RF-44, RF-45, RF-49, RF-51
-- Diagnóstico administrativo sin almacenar contraseñas ni tokens.
-- =============================================================================
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_evento VARCHAR(100) NOT NULL,
    modulo VARCHAR(50) NOT NULL CHECK (modulo IN ('portal_web', 'bot_telegram', 'ia', 'calendar', 'github', 'youtube', 'admin', 'despliegue', 'base_de_datos')),
    descripcion_error TEXT NOT NULL,
    nivel_severidad VARCHAR(20) NOT NULL CHECK (nivel_severidad IN ('INFO', 'WARN', 'ERROR', 'FATAL')),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE logs IS 'Logs del sistema para diagnóstico administrativo y monitoreo de fallos.';

-- =============================================================================
-- 13. TABLA: configuracion
-- Requisitos: RF-07, RF-09, RF-10, RF-50, RF-51
-- Configuración administrativa general y parámetros editables sin cambio de código.
-- =============================================================================
CREATE TABLE IF NOT EXISTS configuracion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_bot VARCHAR(100) NOT NULL DEFAULT 'BotsitoDeJuan_bot',
    url_publica VARCHAR(255) NOT NULL DEFAULT 'https://telegram-bot-production.up.railway.app',
    servicios_activos JSONB NOT NULL DEFAULT '{"ia": true, "calendar": true, "github": true, "youtube": true, "juegos": true}'::jsonb,
    limites_uso JSONB NOT NULL DEFAULT '{"max_comandos_minuto": 30, "max_consultas_ia_dia": 100, "cuota_youtube_diaria": 1000}'::jsonb,
    repositorios_por_defecto JSONB NOT NULL DEFAULT '["torvalds/linux", "facebook/react", "vercel/next.js"]'::jsonb,
    parametros_generales JSONB NOT NULL DEFAULT '{"version": "2.0.0", "mantenimiento": false, "zona_horaria": "America/Bogota"}'::jsonb,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

COMMENT ON TABLE configuracion IS 'Parámetros globales del sistema modificables por el administrador.';

-- =============================================================================
-- ÍNDICES PARA RENDIMIENTO Y REPORTES (RF-52, RF-53, RF-54, RF-55)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_telegram_id ON usuarios(telegram_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_fecha_actividad ON usuarios(fecha_ultima_actividad);
CREATE INDEX IF NOT EXISTS idx_usuarios_fecha_registro ON usuarios(fecha_registro);

CREATE INDEX IF NOT EXISTS idx_sesiones_codigo ON sesiones_verificacion(codigo_verificacion);
CREATE INDEX IF NOT EXISTS idx_sesiones_expiracion ON sesiones_verificacion(expiracion);

CREATE INDEX IF NOT EXISTS idx_integraciones_usuario ON integraciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_integraciones_app_estado ON integraciones(aplicacion, estado_conexion);

CREATE INDEX IF NOT EXISTS idx_tokens_usuario ON tokens(usuario_id);

CREATE INDEX IF NOT EXISTS idx_memoria_usuario_chat ON memoria(usuario_id, chat_id);

CREATE INDEX IF NOT EXISTS idx_eventos_usuario_fecha ON eventos(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha_inicio ON eventos(fecha_inicio);

CREATE INDEX IF NOT EXISTS idx_github_repo ON github(repositorio);
CREATE INDEX IF NOT EXISTS idx_github_fecha ON github(fecha_consulta);
CREATE INDEX IF NOT EXISTS idx_github_usuario ON github(usuario_id);

CREATE INDEX IF NOT EXISTS idx_youtube_fecha ON youtube(fecha_consulta);
CREATE INDEX IF NOT EXISTS idx_youtube_usuario ON youtube(usuario_id);

CREATE INDEX IF NOT EXISTS idx_comandos_fecha ON comandos(fecha_ejecucion);
CREATE INDEX IF NOT EXISTS idx_comandos_comando ON comandos(comando);
CREATE INDEX IF NOT EXISTS idx_comandos_usuario ON comandos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_comandos_resultado ON comandos(resultado);

CREATE INDEX IF NOT EXISTS idx_puntajes_juego_puntos ON puntajes(juego, puntaje_acumulado DESC);
CREATE INDEX IF NOT EXISTS idx_puntajes_usuario ON puntajes(usuario_id);

CREATE INDEX IF NOT EXISTS idx_logs_fecha ON logs(fecha);
CREATE INDEX IF NOT EXISTS idx_logs_modulo ON logs(modulo);
CREATE INDEX IF NOT EXISTS idx_logs_severidad ON logs(nivel_severidad);

-- =============================================================================
-- FUNCIONES Y TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA DE TIMESTAMP
-- =============================================================================
CREATE OR REPLACE FUNCTION actualizar_timestamp_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_usuarios ON usuarios;
CREATE TRIGGER trg_actualizar_usuarios
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();

DROP TRIGGER IF EXISTS trg_actualizar_integraciones ON integraciones;
CREATE TRIGGER trg_actualizar_integraciones
    BEFORE UPDATE ON integraciones
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();

DROP TRIGGER IF EXISTS trg_actualizar_preferencias ON preferencias;
CREATE TRIGGER trg_actualizar_preferencias
    BEFORE UPDATE ON preferencias
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();

DROP TRIGGER IF EXISTS trg_actualizar_memoria ON memoria;
CREATE TRIGGER trg_actualizar_memoria
    BEFORE UPDATE ON memoria
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();

DROP TRIGGER IF EXISTS trg_actualizar_eventos ON eventos;
CREATE TRIGGER trg_actualizar_eventos
    BEFORE UPDATE ON eventos
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();

DROP TRIGGER IF EXISTS trg_actualizar_puntajes ON puntajes;
CREATE TRIGGER trg_actualizar_puntajes
    BEFORE UPDATE ON puntajes
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();

DROP TRIGGER IF EXISTS trg_actualizar_configuracion ON configuracion;
CREATE TRIGGER trg_actualizar_configuracion
    BEFORE UPDATE ON configuracion
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_modificacion();

-- =============================================================================
-- VISTAS PARA EL MÓDULO DE REPORTES (RF-52, RF-53, RF-54, RF-55)
-- Facilitan consultas analíticas y exportación filtrada por fechas y módulos.
-- =============================================================================

-- Vista 1: Reporte General de Usuarios y Actividad
CREATE OR REPLACE VIEW vista_reporte_usuarios AS
SELECT 
    u.id AS usuario_id,
    u.telegram_id,
    u.username,
    u.nombre_visible,
    u.rol,
    u.estado_verificacion,
    u.fecha_registro,
    u.fecha_ultima_actividad,
    COUNT(DISTINCT c.id) AS total_comandos_ejecutados,
    COUNT(DISTINCT CASE WHEN i.estado_conexion = 'conectado' THEN i.id END) AS total_apps_conectadas
FROM usuarios u
LEFT JOIN comandos c ON u.id = c.usuario_id
LEFT JOIN integraciones i ON u.id = i.usuario_id
GROUP BY u.id, u.telegram_id, u.username, u.nombre_visible, u.rol, u.estado_verificacion, u.fecha_registro, u.fecha_ultima_actividad;

-- Vista 2: Reporte de Comandos y Actividad del Bot
CREATE OR REPLACE VIEW vista_reporte_comandos AS
SELECT 
    c.id AS comando_id,
    c.fecha_ejecucion,
    c.comando,
    c.parametros,
    c.resultado,
    c.mensaje_error,
    c.chat_id,
    u.telegram_id,
    u.username,
    u.nombre_visible
FROM comandos c
LEFT JOIN usuarios u ON c.usuario_id = u.id;

-- Vista 3: Reporte de Integraciones Externas
CREATE OR REPLACE VIEW vista_reporte_integraciones AS
SELECT 
    i.id AS integracion_id,
    u.telegram_id,
    u.nombre_visible,
    i.aplicacion,
    i.estado_conexion,
    i.fecha_autorizacion,
    i.fecha_expiracion,
    i.permisos_concedidos,
    CASE WHEN t.id IS NOT NULL THEN TRUE ELSE FALSE END AS tiene_token_almacenado
FROM integraciones i
JOIN usuarios u ON i.usuario_id = u.id
LEFT JOIN tokens t ON i.usuario_id = t.usuario_id AND i.aplicacion = t.servicio;

-- Vista 4: Reporte de Logs y Errores del Sistema
CREATE OR REPLACE VIEW vista_reporte_logs AS
SELECT 
    l.id AS log_id,
    l.fecha,
    l.modulo,
    l.nivel_severidad,
    l.tipo_evento,
    l.descripcion_error,
    u.telegram_id,
    u.username
FROM logs l
LEFT JOIN usuarios u ON l.usuario_id = u.id;

-- Vista 5: Reporte de Consultas a Repositorios GitHub
CREATE OR REPLACE VIEW vista_reporte_github AS
SELECT 
    g.id AS consulta_id,
    g.fecha_consulta,
    g.repositorio,
    g.tipo_consulta,
    g.estado_consulta,
    u.telegram_id,
    u.username
FROM github g
LEFT JOIN usuarios u ON g.usuario_id = u.id;

-- Vista 6: Reporte de Consultas a YouTube
CREATE OR REPLACE VIEW vista_reporte_youtube AS
SELECT 
    y.id AS consulta_id,
    y.fecha_consulta,
    y.tipo_solicitud,
    y.termino_busqueda,
    y.titulo,
    y.canal,
    y.estado_consulta,
    u.telegram_id,
    u.username
FROM youtube y
LEFT JOIN usuarios u ON y.usuario_id = u.id;

-- Vista 7: Reporte de Eventos de Google Calendar
CREATE OR REPLACE VIEW vista_reporte_eventos AS
SELECT 
    e.id AS evento_id,
    e.fecha,
    e.hora,
    e.titulo,
    e.descripcion,
    e.estado,
    e.enlace_evento,
    u.telegram_id,
    u.nombre_visible
FROM eventos e
JOIN usuarios u ON e.usuario_id = u.id;

-- Vista 8: Reporte de Ranking de Juegos
CREATE OR REPLACE VIEW vista_reporte_ranking_juegos AS
SELECT 
    p.juego,
    u.nombre_visible,
    u.username,
    p.puntaje_acumulado,
    p.partidas_jugadas,
    p.aciertos,
    CASE 
        WHEN p.partidas_jugadas > 0 THEN ROUND((p.aciertos::NUMERIC / p.partidas_jugadas::NUMERIC) * 100, 2)
        ELSE 0 
    END AS porcentaje_efectividad,
    p.ultima_participacion
FROM puntajes p
JOIN usuarios u ON p.usuario_id = u.id
ORDER BY p.juego, p.puntaje_acumulado DESC;
