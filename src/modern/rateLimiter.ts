// =============================================================================
// MODULO: RATE LIMITER FORENSE DE AUTENTICACIÓN CLÍNICA
// Estándar de Seguridad: OWASP ASVS v4.0 (V2.2 Authentication Management)
// y Guías de Identidad Digital NIST SP 800-63B (Sección 5.2.2 Brute-Force Rate Limiting)
// =============================================================================

import type { Request } from "express";

export interface RateLimitStatus {
  isLocked: boolean;
  remainingAttempts: number;
  totalAttempts: number;
  maxAttempts: number;
  retryAfterSeconds: number;
  lockoutExpiresAt: Date | null;
  lockoutStage?: number;
}

interface AttemptRecord {
  timestamps: number[];
  lockedUntil: number | null;
  lastAttemptAt: number;
  lastCredential?: string;
  lockoutStage?: number; // 0: 5 min, 1: 30 min, 2: 1h, 3: 6h, 4: 12h, 5+: 24h
}

// Escala de bloqueo progresivo según política clínica:
// 1° Bloqueo: 5 minutos
// 2° Bloqueo: 30 minutos
// 3° Bloqueo: 1 hora
// 4° Bloqueo: 6 horas
// 5° Bloqueo: 12 horas
// 6°+ Bloqueo: 24 horas
export const LOCKOUT_STAGES_MS = [
  5 * 60 * 1000,        // 1°: 5 minutos (300s)
  30 * 60 * 1000,       // 2°: 30 minutos (1800s)
  60 * 60 * 1000,       // 3°: 1 hora (3600s)
  6 * 60 * 60 * 1000,   // 4°: 6 horas (21600s)
  12 * 60 * 60 * 1000,  // 5°: 12 horas (43200s)
  24 * 60 * 60 * 1000,  // 6°+: 24 horas (86400s)
];

// Configuración conforme a estándares OWASP / NIST
export const RATE_LIMIT_CONFIG = {
  MAX_FAILED_ATTEMPTS: 3,               // Límite máximo de 3 intentos fallidos antes de bloqueo
  ATTEMPT_WINDOW_MS: 15 * 60 * 1000,    // Ventana de evaluación: 15 minutos
  LOCKOUT_DURATION_MS: LOCKOUT_STAGES_MS[0], // Duración del primer bloqueo (5 minutos)
};

// Almacén en memoria de intentos de login indexado por IP del cliente
const loginAttemptsMap = new Map<string, AttemptRecord>();

/**
 * Obtiene la dirección IP real del cliente respetando proxies reversos (Railway, Cloudflare, etc.)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

/**
 * Limpia registros obsoletos fuera de la ventana de tiempo
 */
function cleanExpiredAttempts(record: AttemptRecord, now: number): void {
  // Si no ha habido actividad en más de 24 horas, restablecer la etapa
  if (now - record.lastAttemptAt > 24 * 60 * 60 * 1000) {
    record.lockoutStage = 0;
  }

  // Limpiar intentos que cayeron fuera de la ventana de 15 minutos
  record.timestamps = record.timestamps.filter(ts => (now - ts) < RATE_LIMIT_CONFIG.ATTEMPT_WINDOW_MS);
  
  // Si el bloqueo expiró, remover el estado de bloqueo activo y reiniciar intentos del ciclo
  if (record.lockedUntil && now >= record.lockedUntil) {
    record.lockedUntil = null;
    record.timestamps = []; // Se reinicia el conteo para el nuevo ciclo de 3 intentos
  }
}

/**
 * Consulta el estado actual de rate limit para una IP sin registrar nuevo intento
 */
export function getLoginRateLimitStatus(ip: string): RateLimitStatus {
  const now = Date.now();
  const record = loginAttemptsMap.get(ip);

  if (!record) {
    return {
      isLocked: false,
      remainingAttempts: RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS,
      totalAttempts: 0,
      maxAttempts: RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS,
      retryAfterSeconds: 0,
      lockoutExpiresAt: null,
      lockoutStage: 0,
    };
  }

  cleanExpiredAttempts(record, now);

  if (record.lockedUntil && now < record.lockedUntil) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
    return {
      isLocked: true,
      remainingAttempts: 0,
      totalAttempts: record.timestamps.length,
      maxAttempts: RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS,
      retryAfterSeconds,
      lockoutExpiresAt: new Date(record.lockedUntil),
      lockoutStage: record.lockoutStage ?? 0,
    };
  }

  const failedCount = record.timestamps.length;
  const remainingAttempts = Math.max(0, RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS - failedCount);

  return {
    isLocked: false,
    remainingAttempts,
    totalAttempts: failedCount,
    maxAttempts: RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS,
    retryAfterSeconds: 0,
    lockoutExpiresAt: null,
    lockoutStage: record.lockoutStage ?? 0,
  };
}

/**
 * Registra un intento fallido de autenticación.
 * Si se alcanza el límite, activa el bloqueo temporal escalonado (5m -> 30m -> 1h -> 6h -> 12h -> 24h).
 */
export function recordFailedLoginAttempt(ip: string, credential?: string): RateLimitStatus {
  const now = Date.now();
  let record = loginAttemptsMap.get(ip);

  if (!record) {
    record = {
      timestamps: [],
      lockedUntil: null,
      lastAttemptAt: now,
      lastCredential: credential,
      lockoutStage: 0,
    };
    loginAttemptsMap.set(ip, record);
  }

  cleanExpiredAttempts(record, now);

  // Si ya estaba bloqueado, mantener el bloqueo
  if (record.lockedUntil && now < record.lockedUntil) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
    return {
      isLocked: true,
      remainingAttempts: 0,
      totalAttempts: record.timestamps.length,
      maxAttempts: RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS,
      retryAfterSeconds,
      lockoutExpiresAt: new Date(record.lockedUntil),
      lockoutStage: record.lockoutStage ?? 0,
    };
  }

  // Anti-rebote / Anti-spam: Si el último intento fue hace menos de 1200ms
  // (por ejemplo, múltiples Enter invisibles mientras viajaba la petición anterior),
  // no duplicar la penalización de intentos.
  if (record.timestamps.length > 0 && (now - record.lastAttemptAt < 1200)) {
    return getLoginRateLimitStatus(ip);
  }

  // Agregar nuevo intento fallido
  record.timestamps.push(now);
  record.lastAttemptAt = now;
  record.lastCredential = credential;

  // Verificar si supera el umbral
  if (record.timestamps.length >= RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS) {
    const currentStage = record.lockoutStage ?? 0;
    const stageIndex = Math.min(currentStage, LOCKOUT_STAGES_MS.length - 1);
    const durationMs = LOCKOUT_STAGES_MS[stageIndex];

    record.lockedUntil = now + durationMs;
    // Avanzar la etapa para el próximo bloqueo si vuelve a agotar intentos
    record.lockoutStage = stageIndex + 1;

    const retryAfterSeconds = Math.ceil(durationMs / 1000);
    return {
      isLocked: true,
      remainingAttempts: 0,
      totalAttempts: record.timestamps.length,
      maxAttempts: RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS,
      retryAfterSeconds,
      lockoutExpiresAt: new Date(record.lockedUntil),
      lockoutStage: record.lockoutStage,
    };
  }

  const remainingAttempts = RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS - record.timestamps.length;

  return {
    isLocked: false,
    remainingAttempts,
    totalAttempts: record.timestamps.length,
    maxAttempts: RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS,
    retryAfterSeconds: 0,
    lockoutExpiresAt: null,
    lockoutStage: record.lockoutStage ?? 0,
  };
}

/**
 * Restablece los intentos tras una autenticación exitosa (Standard OWASP ASVS)
 */
export function recordSuccessfulLogin(ip: string): void {
  loginAttemptsMap.delete(ip);
}

/**
 * Restablece manualmente el rate limit para propósitos de prueba o soporte docente
 */
export function resetLoginRateLimit(ip: string): void {
  loginAttemptsMap.delete(ip);
}
