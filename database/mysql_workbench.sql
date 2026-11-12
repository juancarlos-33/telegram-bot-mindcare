-- =============================================================================
-- PROYECTO: Telegram Bot con Portal Web, Verificación e Integraciones
-- COMPATIBILIDAD: MySQL 8.0+ / MariaDB / MySQL Workbench
-- INSTRUCCIONES: 
--   1. Abre MySQL Workbench.
--   2. Conéctate a tu servidor local o remoto.
--   3. Abre este archivo (File -> Open SQL Script...) o pega su contenido.
--   4. Presiona el botón del rayo (Execute) o presiona Ctrl + Shift + Enter.
--   5. Para ver el diagrama EER: Menú Database -> Reverse Engineer (Ctrl + R).
-- =============================================================================

CREATE DATABASE IF NOT EXISTS telegram_bot_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE telegram_bot_db;

-- Desactivar temporalmente revisión de llaves foráneas para recreación limpia
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS sesiones_verificacion;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS integraciones;
DROP TABLE IF EXISTS preferencias;
DROP TABLE IF EXISTS memoria;
DROP TABLE IF EXISTS eventos;
DROP TABLE IF EXISTS github;
DROP TABLE IF EXISTS youtube;
DROP TABLE IF EXISTS comandos;
DROP TABLE IF EXISTS puntajes;
DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS configuracion;
DROP TABLE IF EXISTS usuarios;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. TABLA: usuarios (RF-01, RF-02, RF-06, RF-12, RF-18, RF-41)
-- =============================================================================
CREATE TABLE usuarios (
    id VARCHAR(36) PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE COMMENT 'ID de Telegram (BIGINT para soportar enteros de más de 32 bits)',
    username VARCHAR(255) NULL COMMENT 'Handle @usuario de Telegram',
    nombre_visible VARCHAR(255) NOT NULL COMMENT 'First name o nombre del usuario',
    rol ENUM('usuario', 'administrador') NOT NULL DEFAULT 'usuario' COMMENT 'Control de acceso administrativo (RF-06)',
    estado_verificacion ENUM('pendiente', 'verificado', 'bloqueado') NOT NULL DEFAULT 'pendiente',
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_ultima_actividad DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_usuarios_telegram_id (telegram_id),
    INDEX idx_usuarios_username (username),
    INDEX idx_usuarios_fecha_actividad (fecha_ultima_actividad)
) ENGINE=InnoDB COMMENT='Usuarios registrados y verificados desde web y bot';

-- =============================================================================
-- 2. TABLA: sesiones_verificacion (RF-02, RF-11, RF-12, RF-15)
-- =============================================================================
CREATE TABLE sesiones_verificacion (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NULL,
    codigo_verificacion VARCHAR(64) NOT NULL UNIQUE COMMENT 'Token efímero web -> Telegram',
    token_sesion VARCHAR(128) NULL UNIQUE COMMENT 'Sesión de navegador',
    telegram_id_provisional BIGINT NULL,
    completado BOOLEAN NOT NULL DEFAULT FALSE,
    expiracion DATETIME NOT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sesiones_codigo (codigo_verificacion),
    INDEX idx_sesiones_expiracion (expiracion),
    CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Sesiones temporales para enlace de verificación';

-- =============================================================================
-- 3. TABLA: integraciones (RF-03, RF-09, RF-13, RF-14, RF-26, RF-31, RF-42)
-- =============================================================================
CREATE TABLE integraciones (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NOT NULL,
    aplicacion ENUM('google_calendar', 'github', 'youtube') NOT NULL,
    estado_conexion ENUM('conectado', 'desconectado', 'pendiente', 'revocado', 'error') NOT NULL DEFAULT 'desconectado',
    fecha_autorizacion DATETIME NULL,
    fecha_expiracion DATETIME NULL,
    permisos_concedidos LONGTEXT NULL COMMENT 'Scopes autorizados en formato JSON',
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuario_aplicacion (usuario_id, aplicacion),
    INDEX idx_integraciones_app_estado (aplicacion, estado_conexion),
    CONSTRAINT fk_integracion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Estado de aplicaciones conectadas por usuario';

-- =============================================================================
-- 4. TABLA: tokens (RF-07, RF-46, RF-51, Reglas de Almacenamiento Seguro)
-- =============================================================================
CREATE TABLE tokens (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NOT NULL,
    servicio ENUM('google_calendar', 'github', 'youtube') NOT NULL,
    token_cifrado TEXT NOT NULL COMMENT 'Access token cifrado con AES-256',
    refresh_token_cifrado TEXT NULL COMMENT 'Refresh token cifrado con AES-256',
    iv_cifrado VARCHAR(64) NULL COMMENT 'Vector de inicialización AES',
    tipo_token VARCHAR(50) DEFAULT 'Bearer',
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuario_servicio_token (usuario_id, servicio),
    CONSTRAINT fk_token_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Tokens de servicios externos protegidos con cifrado';

-- =============================================================================
-- 5. TABLA: preferencias (RF-10, RF-43, RF-51)
-- =============================================================================
CREATE TABLE preferencias (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NOT NULL UNIQUE,
    idioma VARCHAR(10) NOT NULL DEFAULT 'es',
    zona_horaria VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
    repositorio_predeterminado VARCHAR(255) NULL,
    calendario_predeterminado VARCHAR(255) DEFAULT 'primary',
    preferencias_respuesta LONGTEXT NULL,
    opciones_privacidad LONGTEXT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_preferencia_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Preferencias personalizadas de usuario';

-- =============================================================================
-- 6. TABLA: memoria (RF-22, RF-24, RF-43, RF-51)
-- =============================================================================
CREATE TABLE memoria (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NOT NULL,
    chat_id BIGINT NOT NULL,
    resumen_conversacion TEXT NOT NULL COMMENT 'Resumen comprimido para contexto de IA',
    ultimos_temas LONGTEXT NULL,
    total_interacciones INT NOT NULL DEFAULT 1,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuario_chat_memoria (usuario_id, chat_id),
    CONSTRAINT fk_memoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Memoria resumida de conversación con IA';

-- =============================================================================
-- 7. TABLA: eventos (RF-26, RF-28, RF-30, RF-51)
-- =============================================================================
CREATE TABLE eventos (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NOT NULL,
    id_evento_externo VARCHAR(255) NULL COMMENT 'ID de Google Calendar',
    titulo VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    fecha_inicio DATETIME NULL,
    fecha_fin DATETIME NULL,
    descripcion TEXT NULL,
    estado ENUM('creado', 'sincronizado', 'cancelado', 'pendiente') NOT NULL DEFAULT 'creado',
    enlace_evento TEXT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_eventos_usuario_fecha (usuario_id, fecha),
    INDEX idx_eventos_fecha_inicio (fecha_inicio),
    CONSTRAINT fk_evento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Eventos agendados en Google Calendar';

-- =============================================================================
-- 8. TABLA: github (RF-31, RF-32, RF-33, RF-34, RF-35, RF-51)
-- =============================================================================
CREATE TABLE github (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NULL,
    chat_id BIGINT NOT NULL,
    repositorio VARCHAR(255) NOT NULL,
    tipo_consulta ENUM('issues', 'pull_requests', 'commits', 'actividad', 'info_repo') NOT NULL,
    resultado_resumido LONGTEXT NULL,
    estado_consulta ENUM('exitosa', 'sin_permiso', 'no_encontrado', 'error') NOT NULL,
    fecha_consulta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_github_repo (repositorio),
    INDEX idx_github_fecha (fecha_consulta),
    CONSTRAINT fk_github_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Historial y caché de consultas de GitHub';

-- =============================================================================
-- 9. TABLA: youtube (RF-36, RF-37, RF-38, RF-39, RF-40, RF-51)
-- =============================================================================
CREATE TABLE youtube (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NULL,
    chat_id BIGINT NOT NULL,
    tipo_solicitud ENUM('busqueda', 'reconocimiento_enlace', 'canal') NOT NULL,
    termino_busqueda VARCHAR(255) NULL,
    url_video TEXT NULL,
    titulo VARCHAR(255) NULL,
    canal VARCHAR(255) NULL,
    resultado_resumido LONGTEXT NULL,
    estado_consulta ENUM('exitosa', 'cuota_agotada', 'no_encontrado', 'error') NOT NULL,
    fecha_consulta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_youtube_fecha (fecha_consulta),
    CONSTRAINT fk_youtube_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Consultas de búsqueda y videos de YouTube';

-- =============================================================================
-- 10. TABLA: comandos (RF-16, RF-17, RF-19, RF-20, RF-51)
-- =============================================================================
CREATE TABLE comandos (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NULL,
    chat_id BIGINT NOT NULL,
    comando VARCHAR(100) NOT NULL,
    parametros TEXT NULL,
    resultado ENUM('exito', 'error', 'no_autorizado', 'desconocido') NOT NULL,
    mensaje_error TEXT NULL,
    fecha_ejecucion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_comandos_fecha (fecha_ejecucion),
    INDEX idx_comandos_comando (comando),
    INDEX idx_comandos_resultado (resultado),
    CONSTRAINT fk_comando_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Registro analítico de comandos ejecutados';

-- =============================================================================
-- 11. TABLA: puntajes (RF-19, RF-51)
-- =============================================================================
CREATE TABLE puntajes (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NOT NULL,
    juego ENUM('trivia', 'dado', 'moneda', 'piedra_papel_tijera', 'eco', 'hora', 'otro') NOT NULL,
    puntaje_acumulado INT NOT NULL DEFAULT 0,
    partidas_jugadas INT NOT NULL DEFAULT 0,
    aciertos INT NOT NULL DEFAULT 0,
    ultima_participacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuario_juego (usuario_id, juego),
    INDEX idx_puntajes_ranking (juego, puntaje_acumulado DESC),
    CONSTRAINT fk_puntaje_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Puntajes y estadísticas de juegos';

-- =============================================================================
-- 12. TABLA: logs (RF-08, RF-20, RF-25, RF-44, RF-45, RF-49, RF-51)
-- =============================================================================
CREATE TABLE logs (
    id VARCHAR(36) PRIMARY KEY,
    tipo_evento VARCHAR(100) NOT NULL,
    modulo ENUM('portal_web', 'bot_telegram', 'ia', 'calendar', 'github', 'youtube', 'admin', 'despliegue', 'base_de_datos') NOT NULL,
    descripcion_error TEXT NOT NULL,
    nivel_severidad ENUM('INFO', 'WARN', 'ERROR', 'FATAL') NOT NULL,
    usuario_id VARCHAR(36) NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_logs_fecha (fecha),
    INDEX idx_logs_modulo_severidad (modulo, nivel_severidad),
    CONSTRAINT fk_log_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Logs de errores y auditoría del sistema';

-- =============================================================================
-- 13. TABLA: configuracion (RF-07, RF-09, RF-10, RF-50, RF-51)
-- =============================================================================
CREATE TABLE configuracion (
    id VARCHAR(36) PRIMARY KEY,
    nombre_bot VARCHAR(100) NOT NULL DEFAULT 'BotsitoDeJuan_bot',
    url_publica VARCHAR(255) NOT NULL DEFAULT 'https://telegram-bot-production.up.railway.app',
    servicios_activos LONGTEXT NULL,
    limites_uso LONGTEXT NULL,
    repositorios_por_defecto LONGTEXT NULL,
    parametros_generales LONGTEXT NULL,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    actualizado_por VARCHAR(36) NULL,
    CONSTRAINT fk_config_usuario FOREIGN KEY (actualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Configuración general administrable';

-- =============================================================================
-- VISTAS PARA EL MÓDULO DE REPORTES (RF-52, RF-53, RF-54, RF-55)
-- =============================================================================

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
    IF(t.id IS NOT NULL, TRUE, FALSE) AS tiene_token_almacenado
FROM integraciones i
JOIN usuarios u ON i.usuario_id = u.id
LEFT JOIN tokens t ON i.usuario_id = t.usuario_id AND i.aplicacion = t.servicio;

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

CREATE OR REPLACE VIEW vista_reporte_ranking_juegos AS
SELECT 
    p.juego,
    u.nombre_visible,
    u.username,
    p.puntaje_acumulado,
    p.partidas_jugadas,
    p.aciertos,
    CASE 
        WHEN p.partidas_jugadas > 0 THEN ROUND((p.aciertos / p.partidas_jugadas) * 100, 2)
        ELSE 0 
    END AS porcentaje_efectividad,
    p.ultima_participacion
FROM puntajes p
JOIN usuarios u ON p.usuario_id = u.id
ORDER BY p.juego, p.puntaje_acumulado DESC;

-- =============================================================================
-- INSERTS DE DATOS DE PRUEBA (SEED)
-- =============================================================================
INSERT INTO configuracion (
    id, nombre_bot, url_publica, servicios_activos, limites_uso, repositorios_por_defecto, parametros_generales
) VALUES (
    'cfg-0001', 'BotsitoDeJuan_bot', 'https://telegram-bot-production.up.railway.app',
    '{"ia": true, "calendar": true, "github": true, "youtube": true, "juegos": true}',
    '{"max_comandos_minuto": 30, "max_consultas_ia_dia": 100, "cuota_youtube_diaria": 1000}',
    '["torvalds/linux", "facebook/react", "vercel/next.js"]',
    '{"version": "2.0.0", "mantenimiento": false, "zona_horaria": "America/Bogota"}'
);

INSERT INTO usuarios (id, telegram_id, username, nombre_visible, rol, estado_verificacion)
VALUES 
    ('usr-0001', 123456789, 'admin_juan', 'Juan Administrador', 'administrador', 'verificado'),
    ('usr-0002', 987654321, 'maria_dev', 'Maria Desarrolladora', 'usuario', 'verificado');

INSERT INTO preferencias (id, usuario_id, idioma, zona_horaria, repositorio_predeterminado, calendario_predeterminado, preferencias_respuesta, opciones_privacidad)
VALUES 
    ('prf-0001', 'usr-0001', 'es', 'America/Bogota', 'juan/telegram-bot', 'primary', '{"modo": "breve", "tono": "amigable"}', '{"guardar_memoria": true}'),
    ('prf-0002', 'usr-0002', 'es', 'America/Bogota', 'facebook/react', 'trabajo', '{"modo": "detallado", "tono": "profesional"}', '{"guardar_memoria": true}');

INSERT INTO integraciones (id, usuario_id, aplicacion, estado_conexion, fecha_autorizacion, fecha_expiracion, permisos_concedidos)
VALUES 
    ('int-0001', 'usr-0001', 'google_calendar', 'conectado', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), '["calendar.events"]'),
    ('int-0002', 'usr-0001', 'github', 'conectado', NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), '["repo", "read:user"]');

INSERT INTO tokens (id, usuario_id, servicio, token_cifrado, refresh_token_cifrado, iv_cifrado)
VALUES 
    ('tok-0001', 'usr-0001', 'google_calendar', 'enc_token_access_google_calendar_demo', 'enc_refresh_token_demo', 'a1b2c3d4e5f6'),
    ('tok-0002', 'usr-0001', 'github', 'enc_token_access_github_demo', NULL, '1807f6e5d4c3');

INSERT INTO puntajes (id, usuario_id, juego, puntaje_acumulado, partidas_jugadas, aciertos)
VALUES 
    ('scr-0001', 'usr-0001', 'trivia', 120, 15, 12),
    ('scr-0002', 'usr-0001', 'piedra_papel_tijera', 50, 10, 7),
    ('scr-0003', 'usr-0002', 'trivia', 90, 10, 9);

INSERT INTO comandos (id, usuario_id, chat_id, comando, parametros, resultado)
VALUES 
    ('cmd-0001', 'usr-0001', 123456789, '/start', NULL, 'exito'),
    ('cmd-0002', 'usr-0001', 123456789, '/menu', NULL, 'exito'),
    ('cmd-0003', 'usr-0001', 123456789, '/github', 'facebook/react', 'exito');

INSERT INTO logs (id, tipo_evento, modulo, descripcion_error, nivel_severidad, usuario_id)
VALUES 
    ('log-0001', 'ARRANQUE', 'despliegue', 'Bot iniciado correctamente en Railway y conectado a MySQL', 'INFO', 'usr-0001');
