-- =============================================================================
-- PROYECTO: Telegram Bot
-- SCRIPT: Datos iniciales y de prueba (Seed Data) para Neon PostgreSQL
-- =============================================================================

-- 1. Insertar Configuración Global Inicial (RF-07, RF-09, RF-10, RF-50)
INSERT INTO configuracion (
    nombre_bot,
    url_publica,
    servicios_activos,
    limites_uso,
    repositorios_por_defecto,
    parametros_generales
) VALUES (
    'BotsitoDeJuan_bot',
    'https://telegram-bot-production.up.railway.app',
    '{"ia": true, "calendar": true, "github": true, "youtube": true, "juegos": true}'::jsonb,
    '{"max_comandos_minuto": 30, "max_consultas_ia_dia": 100, "cuota_youtube_diaria": 1000}'::jsonb,
    '["torvalds/linux", "facebook/react", "vercel/next.js"]'::jsonb,
    '{"version": "2.0.0", "mantenimiento": false, "zona_horaria": "America/Bogota"}'::jsonb
);

-- 2. Insertar Usuarios de Prueba (Administrador y Usuario regular)
-- Nota: telegram_id son IDs realistas de Telegram
INSERT INTO usuarios (id, telegram_id, username, nombre_visible, rol, estado_verificacion)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 123456789, 'admin_juan', 'Juan Administrador', 'administrador', 'verificado'),
    ('b0000000-0000-0000-0000-000000000002', 987654321, 'maria_dev', 'Maria Desarrolladora', 'usuario', 'verificado'),
    ('c0000000-0000-0000-0000-000000000003', 555444333, 'carlos_estudiante', 'Carlos Estudiante', 'usuario', 'pendiente')
ON CONFLICT (telegram_id) DO NOTHING;

-- 3. Insertar Preferencias
INSERT INTO preferencias (usuario_id, idioma, zona_horaria, repositorio_predeterminado, calendario_predeterminado)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'es', 'America/Bogota', 'juan/telegram-bot', 'primary'),
    ('b0000000-0000-0000-0000-000000000002', 'es', 'America/Bogota', 'facebook/react', 'trabajo')
ON CONFLICT (usuario_id) DO NOTHING;

-- 4. Insertar Integraciones de Ejemplo
INSERT INTO integraciones (usuario_id, aplicacion, estado_conexion, fecha_autorizacion, fecha_expiracion, permisos_concedidos)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'google_calendar', 'conectado', NOW(), NOW() + INTERVAL '30 days', '["calendar.events", "calendar.readonly"]'::jsonb),
    ('a0000000-0000-0000-0000-000000000001', 'github', 'conectado', NOW(), NOW() + INTERVAL '90 days', '["repo", "read:user"]'::jsonb),
    ('a0000000-0000-0000-0000-000000000001', 'youtube', 'conectado', NOW(), NULL, '["youtube.readonly"]'::jsonb),
    ('b0000000-0000-0000-0000-000000000002', 'github', 'conectado', NOW(), NOW() + INTERVAL '60 days', '["public_repo"]'::jsonb)
ON CONFLICT (usuario_id, aplicacion) DO NOTHING;

-- 5. Insertar Tokens Cifrados de Ejemplo (Simulación de cifrado AES-256)
INSERT INTO tokens (usuario_id, servicio, token_cifrado, refresh_token_cifrado, iv_cifrado, tipo_token)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'google_calendar', 'enc_gcal_access_token_demo_9876543210abcdef', 'enc_gcal_refresh_token_demo_xyz123', 'a1b2c3d4e5f60718', 'Bearer'),
    ('a0000000-0000-0000-0000-000000000001', 'github', 'enc_gho_token_demo_secret_token_placeholder', NULL, '1807f6e5d4c3b2a1', 'Bearer')
ON CONFLICT (usuario_id, servicio) DO NOTHING;

-- 6. Insertar Memoria de IA Resumida de Ejemplo (RF-22, RF-24)
INSERT INTO memoria (usuario_id, chat_id, resumen_conversacion, ultimos_temas, total_interacciones)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 123456789, 'El usuario estuvo consultando la arquitectura de la base de datos Neon y revisó pull requests del bot.', '["neon postgresql", "pull requests", "railway deployment"]'::jsonb, 5)
ON CONFLICT (usuario_id, chat_id) DO NOTHING;

-- 7. Insertar Evento de Google Calendar de Ejemplo (RF-28)
INSERT INTO eventos (usuario_id, id_evento_externo, titulo, fecha, hora, fecha_inicio, fecha_fin, descripcion, estado, enlace_evento)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'gcal_ev_12345', 'Sustentación Proyecto Telegram Bot', CURRENT_DATE + 5, '10:00:00', (CURRENT_DATE + 5) + TIME '10:00:00', (CURRENT_DATE + 5) + TIME '11:00:00', 'Presentación final académica con Neon y Railway', 'creado', 'https://calendar.google.com/calendar/event?eid=demo');

-- 8. Insertar Consultas de GitHub de Ejemplo (RF-32, RF-33, RF-34)
INSERT INTO github (usuario_id, chat_id, repositorio, tipo_consulta, resultado_resumido, estado_consulta)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 123456789, 'facebook/react', 'issues', '{"total_issues": 3, "destacados": ["Fix concurrent rendering bug", "Docs update"]}'::jsonb, 'exitosa'),
    ('a0000000-0000-0000-0000-000000000001', 123456789, 'facebook/react', 'pull_requests', '{"total_prs": 2, "destacados": ["PR #24501 Add useTransition support"]}'::jsonb, 'exitosa');

-- 9. Insertar Consulta de YouTube de Ejemplo (RF-38, RF-39)
INSERT INTO youtube (usuario_id, chat_id, tipo_solicitud, termino_busqueda, titulo, canal, url_video, estado_consulta)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 123456789, 'busqueda', 'tutorial neon postgresql railway', 'Cómo conectar Neon con Railway en 5 minutos', 'Tech Latino', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'exitosa');

-- 10. Insertar Puntajes de Juegos (RF-19)
INSERT INTO puntajes (usuario_id, juego, puntaje_acumulado, partidas_jugadas, aciertos)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'trivia', 120, 15, 12),
    ('a0000000-0000-0000-0000-000000000001', 'piedra_papel_tijera', 45, 10, 6),
    ('b0000000-0000-0000-0000-000000000002', 'trivia', 90, 10, 9)
ON CONFLICT (usuario_id, juego) DO NOTHING;

-- 11. Insertar Comandos Ejecutados (RF-16, RF-17, RF-19)
INSERT INTO comandos (usuario_id, chat_id, comando, parametros, resultado)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 123456789, '/start', NULL, 'exito'),
    ('a0000000-0000-0000-0000-000000000001', 123456789, '/menu', NULL, 'exito'),
    ('a0000000-0000-0000-0000-000000000001', 123456789, '/github', 'facebook/react', 'exito'),
    ('b0000000-0000-0000-0000-000000000002', 987654321, '/trivia', NULL, 'exito');

-- 12. Insertar Logs del Sistema (RF-08, RF-44, RF-49)
INSERT INTO logs (tipo_evento, modulo, descripcion_error, nivel_severidad, usuario_id)
VALUES
    ('ARRANQUE', 'despliegue', 'Bot iniciado correctamente en Railway con conexión a Neon PostgreSQL', 'INFO', 'a0000000-0000-0000-0000-000000000001'),
    ('VERIFICACION', 'portal_web', 'Usuario admin_juan verificado exitosamente mediante portal', 'INFO', 'a0000000-0000-0000-0000-000000000001');
