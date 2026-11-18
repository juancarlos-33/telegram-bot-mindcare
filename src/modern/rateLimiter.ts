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
}

interface AttemptRecord {
  timestamps: number[];
  lockedUntil: number | null;
  lastAttemptAt: number;
  lastCredential?: string;
}

// Configuración conforme a estándares OWASP / NIST
export const RATE_LIMIT_CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,               // Límite máximo de intentos fallidos antes de bloqueo
  ATTEMPT_WINDOW_MS: 15 * 60 * 1000,    // Ventana de evaluación: 15 minutos
  LOCKOUT_DURATION_MS: 3 * 60 * 1000,   // Duración del bloqueo: 3 minutos (180s) pedagógico / demo
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
  // Limpiar intentos que cayeron fuera de la ventana de 15 minutos
  record.timestamps = record.timestamps.filter(ts => (now - ts) < RATE_LIMIT_CONFIG.ATTEMPT_WINDOW_MS);
  
  // Si el bloqueo expiró, remover el estado de bloqueo
  if (record.lockedUntil && now >= record.lockedUntil) {
    record.lockedUntil = null;
    record.timestamps = []; // Se reinicia el conteo al expirar el bloqueo
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
  };
}

/**
 * Registra un intento fallido de autenticación.
 * Si se alcanza el límite, activa el bloqueo temporal.
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
    };
  }

  // Agregar nuevo intento fallido
  record.timestamps.push(now);
  record.lastAttemptAt = now;
  record.lastCredential = credential;

  // Verificar si supera el umbral
  if (record.timestamps.length >= RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + RATE_LIMIT_CONFIG.LOCKOUT_DURATION_MS;
    const retryAfterSeconds = Math.ceil(RATE_LIMIT_CONFIG.LOCKOUT_DURATION_MS / 1000);
    return {
      isLocked: true,
      remainingAttempts: 0,
      totalAttempts: record.timestamps.length,
      maxAttempts: RATE_LIMIT_CONFIG.MAX_FAILED_ATTEMPTS,
      retryAfterSeconds,
      lockoutExpiresAt: new Date(record.lockedUntil),
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
