-- =============================================================================
-- PROYECTO: Telegram Bot con Portal Web, Verificación e Integraciones
-- COMPATIBILIDAD: Microsoft SQL Server (SSMS - SQL Server Management Studio)
-- INSTRUCCIONES: 
--   1. Abre SQL Server Management Studio (SSMS).
--   2. Conéctate a tu instancia de SQL Server (localhost / SQLEXPRESS).
--   3. Abre este archivo (File -> Open -> File...) o pega su contenido en una Nueva Consulta.
--   4. Presiona F5 o haz clic en "Ejecutar" (Execute).
--   5. Para ver el Diagrama en SSMS: 
--      Explorador de Objetos -> TelegramBotDB -> Diagramas de base de datos -> Nuevo diagrama de base de datos.
-- =============================================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'TelegramBotDB')
BEGIN
    CREATE DATABASE TelegramBotDB;
END
GO

USE TelegramBotDB;
GO

-- =============================================================================
-- 1. TABLA: usuarios (RF-01, RF-02, RF-06, RF-12, RF-18, RF-41)
-- =============================================================================
IF OBJECT_ID('dbo.sesiones_verificacion', 'U') IS NOT NULL DROP TABLE dbo.sesiones_verificacion;
IF OBJECT_ID('dbo.tokens', 'U') IS NOT NULL DROP TABLE dbo.tokens;
IF OBJECT_ID('dbo.integraciones', 'U') IS NOT NULL DROP TABLE dbo.integraciones;
IF OBJECT_ID('dbo.preferencias', 'U') IS NOT NULL DROP TABLE dbo.preferencias;
IF OBJECT_ID('dbo.memoria', 'U') IS NOT NULL DROP TABLE dbo.memoria;
IF OBJECT_ID('dbo.eventos', 'U') IS NOT NULL DROP TABLE dbo.eventos;
IF OBJECT_ID('dbo.github', 'U') IS NOT NULL DROP TABLE dbo.github;
IF OBJECT_ID('dbo.youtube', 'U') IS NOT NULL DROP TABLE dbo.youtube;
IF OBJECT_ID('dbo.comandos', 'U') IS NOT NULL DROP TABLE dbo.comandos;
IF OBJECT_ID('dbo.puntajes', 'U') IS NOT NULL DROP TABLE dbo.puntajes;
IF OBJECT_ID('dbo.logs', 'U') IS NOT NULL DROP TABLE dbo.logs;
IF OBJECT_ID('dbo.configuracion', 'U') IS NOT NULL DROP TABLE dbo.configuracion;
IF OBJECT_ID('dbo.usuarios', 'U') IS NOT NULL DROP TABLE dbo.usuarios;
GO

CREATE TABLE dbo.usuarios (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    telegram_id BIGINT NOT NULL UNIQUE,
    username NVARCHAR(255) NULL,
    nombre_visible NVARCHAR(255) NOT NULL,
    rol NVARCHAR(50) NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'administrador')),
    estado_verificacion NVARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (estado_verificacion IN ('pendiente', 'verificado', 'bloqueado')),
    fecha_registro DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    fecha_ultima_actividad DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    actualizado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- =============================================================================
-- 2. TABLA: sesiones_verificacion (RF-02, RF-11, RF-12, RF-15)
-- =============================================================================
CREATE TABLE dbo.sesiones_verificacion (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NULL,
    codigo_verificacion NVARCHAR(64) NOT NULL UNIQUE,
    token_sesion NVARCHAR(128) NULL UNIQUE,
    telegram_id_provisional BIGINT NULL,
    completado BIT NOT NULL DEFAULT 0,
    expiracion DATETIME2 NOT NULL,
    creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 3. TABLA: integraciones (RF-03, RF-09, RF-13, RF-14, RF-26, RF-31, RF-42)
-- =============================================================================
CREATE TABLE dbo.integraciones (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NOT NULL,
    aplicacion NVARCHAR(50) NOT NULL CHECK (aplicacion IN ('google_calendar', 'github', 'youtube')),
    estado_conexion NVARCHAR(50) NOT NULL DEFAULT 'desconectado' CHECK (estado_conexion IN ('conectado', 'desconectado', 'pendiente', 'revocado', 'error')),
    fecha_autorizacion DATETIME2 NULL,
    fecha_expiracion DATETIME2 NULL,
    permisos_concedidos NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    actualizado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_usuario_aplicacion UNIQUE (usuario_id, aplicacion),
    CONSTRAINT fk_integracion_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 4. TABLA: tokens (RF-07, RF-46, RF-51)
-- =============================================================================
CREATE TABLE dbo.tokens (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NOT NULL,
    servicio NVARCHAR(50) NOT NULL CHECK (servicio IN ('google_calendar', 'github', 'youtube')),
    token_cifrado NVARCHAR(MAX) NOT NULL,
    refresh_token_cifrado NVARCHAR(MAX) NULL,
    iv_cifrado NVARCHAR(64) NULL,
    tipo_token NVARCHAR(50) DEFAULT 'Bearer',
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_usuario_servicio_token UNIQUE (usuario_id, servicio),
    CONSTRAINT fk_token_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 5. TABLA: preferencias (RF-10, RF-43, RF-51)
-- =============================================================================
CREATE TABLE dbo.preferencias (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NOT NULL UNIQUE,
    idioma NVARCHAR(10) NOT NULL DEFAULT 'es',
    zona_horaria NVARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
    repositorio_predeterminado NVARCHAR(255) NULL,
    calendario_predeterminado NVARCHAR(255) DEFAULT 'primary',
    preferencias_respuesta NVARCHAR(MAX) NOT NULL DEFAULT '{"modo": "breve", "tono": "amigable"}',
    opciones_privacidad NVARCHAR(MAX) NOT NULL DEFAULT '{"guardar_memoria": true}',
    creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    actualizado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_preferencia_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 6. TABLA: memoria (RF-22, RF-24, RF-43, RF-51)
-- =============================================================================
CREATE TABLE dbo.memoria (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NOT NULL,
    chat_id BIGINT NOT NULL,
    resumen_conversacion NVARCHAR(MAX) NOT NULL,
    ultimos_temas NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    total_interacciones INT NOT NULL DEFAULT 1,
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_usuario_chat_memoria UNIQUE (usuario_id, chat_id),
    CONSTRAINT fk_memoria_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 7. TABLA: eventos (RF-26, RF-28, RF-30, RF-51)
-- =============================================================================
CREATE TABLE dbo.eventos (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NOT NULL,
    id_evento_externo NVARCHAR(255) NULL,
    titulo NVARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    fecha_inicio DATETIME2 NULL,
    fecha_fin DATETIME2 NULL,
    descripcion NVARCHAR(MAX) NULL,
    estado NVARCHAR(50) NOT NULL DEFAULT 'creado' CHECK (estado IN ('creado', 'sincronizado', 'cancelado', 'pendiente')),
    enlace_evento NVARCHAR(MAX) NULL,
    creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    actualizado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_evento_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 8. TABLA: github (RF-31, RF-32, RF-33, RF-34, RF-35, RF-51)
-- =============================================================================
CREATE TABLE dbo.github (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NULL,
    chat_id BIGINT NOT NULL,
    repositorio NVARCHAR(255) NOT NULL,
    tipo_consulta NVARCHAR(50) NOT NULL CHECK (tipo_consulta IN ('issues', 'pull_requests', 'commits', 'actividad', 'info_repo')),
    resultado_resumido NVARCHAR(MAX) NOT NULL,
    estado_consulta NVARCHAR(50) NOT NULL CHECK (estado_consulta IN ('exitosa', 'sin_permiso', 'no_encontrado', 'error')),
    fecha_consulta DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_github_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE SET NULL
);
GO

-- =============================================================================
-- 9. TABLA: youtube (RF-36, RF-37, RF-38, RF-39, RF-40, RF-51)
-- =============================================================================
CREATE TABLE dbo.youtube (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NULL,
    chat_id BIGINT NOT NULL,
    tipo_solicitud NVARCHAR(50) NOT NULL CHECK (tipo_solicitud IN ('busqueda', 'reconocimiento_enlace', 'canal')),
    termino_busqueda NVARCHAR(255) NULL,
    url_video NVARCHAR(MAX) NULL,
    titulo NVARCHAR(255) NULL,
    canal NVARCHAR(255) NULL,
    resultado_resumido NVARCHAR(MAX) NULL,
    estado_consulta NVARCHAR(50) NOT NULL CHECK (estado_consulta IN ('exitosa', 'cuota_agotada', 'no_encontrado', 'error')),
    fecha_consulta DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_youtube_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE SET NULL
);
GO

-- =============================================================================
-- 10. TABLA: comandos (RF-16, RF-17, RF-19, RF-20, RF-51)
-- =============================================================================
CREATE TABLE dbo.comandos (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NULL,
    chat_id BIGINT NOT NULL,
    comando NVARCHAR(100) NOT NULL,
    parametros NVARCHAR(MAX) NULL,
    resultado NVARCHAR(50) NOT NULL CHECK (resultado IN ('exito', 'error', 'no_autorizado', 'desconocido')),
    mensaje_error NVARCHAR(MAX) NULL,
    fecha_ejecucion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_comando_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE SET NULL
);
GO

-- =============================================================================
-- 11. TABLA: puntajes (RF-19, RF-51)
-- =============================================================================
CREATE TABLE dbo.puntajes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER NOT NULL,
    juego NVARCHAR(50) NOT NULL CHECK (juego IN ('trivia', 'dado', 'moneda', 'piedra_papel_tijera', 'eco', 'hora', 'otro')),
    puntaje_acumulado INT NOT NULL DEFAULT 0,
    partidas_jugadas INT NOT NULL DEFAULT 0,
    aciertos INT NOT NULL DEFAULT 0,
    ultima_participacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    actualizado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_usuario_juego UNIQUE (usuario_id, juego),
    CONSTRAINT fk_puntaje_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 12. TABLA: logs (RF-08, RF-20, RF-25, RF-44, RF-45, RF-49, RF-51)
-- =============================================================================
CREATE TABLE dbo.logs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    tipo_evento NVARCHAR(100) NOT NULL,
    modulo NVARCHAR(50) NOT NULL CHECK (modulo IN ('portal_web', 'bot_telegram', 'ia', 'calendar', 'github', 'youtube', 'admin', 'despliegue', 'base_de_datos')),
    descripcion_error NVARCHAR(MAX) NOT NULL,
    nivel_severidad NVARCHAR(20) NOT NULL CHECK (nivel_severidad IN ('INFO', 'WARN', 'ERROR', 'FATAL')),
    usuario_id UNIQUEIDENTIFIER NULL,
    fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_log_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id) ON DELETE SET NULL
);
GO

-- =============================================================================
-- 13. TABLA: configuracion (RF-07, RF-09, RF-10, RF-50, RF-51)
-- =============================================================================
CREATE TABLE dbo.configuracion (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    nombre_bot NVARCHAR(100) NOT NULL DEFAULT 'BotsitoDeJuan_bot',
    url_publica NVARCHAR(255) NOT NULL DEFAULT 'https://telegram-bot-production.up.railway.app',
    servicios_activos NVARCHAR(MAX) NOT NULL DEFAULT '{"ia": true, "calendar": true, "github": true, "youtube": true, "juegos": true}',
    limites_uso NVARCHAR(MAX) NOT NULL DEFAULT '{"max_comandos_minuto": 30, "max_consultas_ia_dia": 100, "cuota_youtube_diaria": 1000}',
    repositorios_por_defecto NVARCHAR(MAX) NOT NULL DEFAULT '["torvalds/linux", "facebook/react", "vercel/next.js"]',
    parametros_generales NVARCHAR(MAX) NOT NULL DEFAULT '{"version": "2.0.0", "mantenimiento": false, "zona_horaria": "America/Bogota"}',
    actualizado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    actualizado_por UNIQUEIDENTIFIER NULL,
    CONSTRAINT fk_config_usuario FOREIGN KEY (actualizado_por) REFERENCES dbo.usuarios(id) ON DELETE SET NULL
);
GO

-- =============================================================================
-- VISTAS PARA EL MÓDULO DE REPORTES (RF-52, RF-53, RF-54, RF-55)
-- =============================================================================
CREATE OR ALTER VIEW dbo.vista_reporte_usuarios AS
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
FROM dbo.usuarios u
LEFT JOIN dbo.comandos c ON u.id = c.usuario_id
LEFT JOIN dbo.integraciones i ON u.id = i.usuario_id
GROUP BY u.id, u.telegram_id, u.username, u.nombre_visible, u.rol, u.estado_verificacion, u.fecha_registro, u.fecha_ultima_actividad;
GO

CREATE OR ALTER VIEW dbo.vista_reporte_comandos AS
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
FROM dbo.comandos c
LEFT JOIN dbo.usuarios u ON c.usuario_id = u.id;
GO

CREATE OR ALTER VIEW dbo.vista_reporte_integraciones AS
SELECT 
    i.id AS integracion_id,
    u.telegram_id,
    u.nombre_visible,
    i.aplicacion,
    i.estado_conexion,
    i.fecha_autorizacion,
    i.fecha_expiracion,
    i.permisos_concedidos,
    CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END AS tiene_token_almacenado
FROM dbo.integraciones i
JOIN dbo.usuarios u ON i.usuario_id = u.id
LEFT JOIN dbo.tokens t ON i.usuario_id = t.usuario_id AND i.aplicacion = t.servicio;
GO

CREATE OR ALTER VIEW dbo.vista_reporte_logs AS
SELECT 
    l.id AS log_id,
    l.fecha,
    l.modulo,
    l.nivel_severidad,
    l.tipo_evento,
    l.descripcion_error,
    u.telegram_id,
    u.username
FROM dbo.logs l
LEFT JOIN dbo.usuarios u ON l.usuario_id = u.id;
GO

CREATE OR ALTER VIEW dbo.vista_reporte_ranking_juegos AS
SELECT 
    p.juego,
    u.nombre_visible,
    u.username,
    p.puntaje_acumulado,
    p.partidas_jugadas,
    p.aciertos,
    CASE 
        WHEN p.partidas_jugadas > 0 THEN ROUND((CAST(p.aciertos AS FLOAT) / CAST(p.partidas_jugadas AS FLOAT)) * 100, 2)
        ELSE 0 
    END AS porcentaje_efectividad,
    p.ultima_participacion
FROM dbo.puntajes p
JOIN dbo.usuarios u ON p.usuario_id = u.id;
GO

-- =============================================================================
-- INSERTS DE DATOS DE PRUEBA (SEED)
-- =============================================================================
INSERT INTO dbo.configuracion (nombre_bot, url_publica)
VALUES ('BotsitoDeJuan_bot', 'https://telegram-bot-production.up.railway.app');

INSERT INTO dbo.usuarios (id, telegram_id, username, nombre_visible, rol, estado_verificacion)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 123456789, 'admin_juan', 'Juan Administrador', 'administrador', 'verificado'),
    ('22222222-2222-2222-2222-222222222222', 987654321, 'maria_dev', 'Maria Desarrolladora', 'usuario', 'verificado');

INSERT INTO dbo.preferencias (usuario_id, idioma, zona_horaria, repositorio_predeterminado)
VALUES ('11111111-1111-1111-1111-111111111111', 'es', 'America/Bogota', 'juan/telegram-bot');

INSERT INTO dbo.puntajes (usuario_id, juego, puntaje_acumulado, partidas_jugadas, aciertos)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'trivia', 120, 15, 12),
    ('11111111-1111-1111-1111-111111111111', 'piedra_papel_tijera', 50, 10, 7);

INSERT INTO dbo.comandos (usuario_id, chat_id, comando, resultado)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 123456789, '/start', 'exito'),
    ('11111111-1111-1111-1111-111111111111', 123456789, '/menu', 'exito');

INSERT INTO dbo.logs (tipo_evento, modulo, descripcion_error, nivel_severidad, usuario_id)
VALUES ('ARRANQUE', 'despliegue', 'Bot iniciado correctamente con SQL Server', 'INFO', '11111111-1111-1111-1111-111111111111');
GO
