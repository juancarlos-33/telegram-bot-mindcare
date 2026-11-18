import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { EventEmitter } from "events";

export const realtimeEvents = new EventEmitter();
realtimeEvents.setMaxListeners(200);

export function broadcastRealtime(type: string, payload: any) {
  realtimeEvents.emit("change", {
    type,
    payload,
    timestamp: new Date().toISOString()
  });
}

const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Error creando directorio data:", err);
  }
}

function loadJsonFile<T>(filename: string, fallback: T): T {
  try {
    const fullPath = path.join(DATA_DIR, filename);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn(`[DB] Error al cargar ${filename}, usando fallback:`, e);
  }
  return fallback;
}

function saveJsonFile<T>(filename: string, data: T): void {
  try {
    const fullPath = path.join(DATA_DIR, filename);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`[DB] Error guardando ${filename}:`, e);
  }
}

const hasDatabase = Boolean(process.env.DATABASE_URL);
export const prisma = hasDatabase ? new PrismaClient() : null;

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
};

type TelegramChat = {
  id: number;
  title?: string;
  type: string;
};

export async function ensureUser(user?: TelegramUser) {
  if (!user) return null;
  const strId = String(user.id);
  const existing = mockUsers.find(u => String(u.telegramId) === strId);
  if (!existing) {
    mockUsers.unshift({
      id: "usr-" + user.id,
      telegramId: strId,
      username: user.username,
      firstName: user.first_name ?? "Usuario Telegram",
      rol: "usuario",
      estadoVerificacion: "verificado",
      fechaRegistro: new Date(),
      fechaUltimaActividad: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } else {
    existing.fechaUltimaActividad = new Date();
    if (user.username) existing.username = user.username;
    if (user.first_name) existing.firstName = user.first_name;
  }

  if (!prisma) return existing ?? mockUsers[0];
  try {
    return await prisma.user.upsert({
      where: { telegramId: String(user.id) },
      update: {
        username: user.username,
        firstName: user.first_name,
        fechaUltimaActividad: new Date(),
        estadoVerificacion: "verificado"
      },
      create: {
        telegramId: String(user.id),
        username: user.username,
        firstName: user.first_name,
        karma: 0,
        money: 100, // Starting bonus
        xp: 0,
        level: 1,
        estadoVerificacion: "verificado",
        rol: "usuario"
      }
    });
  } catch {
    return existing ?? mockUsers[0];
  }
}

export async function addXp(user: TelegramUser | undefined, amount: number) {
  const dbUser = await ensureUser(user);
  if (!dbUser || !prisma) return null;
  
  const newXp = dbUser.xp + amount;
  const newLevel = Math.floor(0.1 * Math.sqrt(newXp)) + 1; // Basic leveling formula
  
  const leveledUp = newLevel > dbUser.level;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { 
        xp: newXp,
        level: newLevel,
        money: leveledUp ? dbUser.money + 500 : dbUser.money // Bonus money on level up
      }
    });
    return { user: updatedUser, leveledUp };
  } catch {
    return null;
  }
}

export async function ensureGroup(chat?: TelegramChat) {
  if (!chat || !prisma || (chat.type !== "group" && chat.type !== "supergroup")) return null;
  try {
    return await prisma.group.upsert({
      where: { telegramId: String(chat.id) },
      update: {
        title: chat.title
      },
      create: {
        telegramId: String(chat.id),
        title: chat.title
      }
    });
  } catch {
    return null;
  }
}

export async function addKarma(user: TelegramUser | undefined, amount: number) {
  const dbUser = await ensureUser(user);
  if (!dbUser || !prisma) return null;
  return prisma.user.update({
    where: { id: dbUser.id },
    data: { karma: { increment: amount } }
  });
}

export async function addMoney(user: TelegramUser | undefined, amount: number) {
  const dbUser = await ensureUser(user);
  if (!dbUser || !prisma) return null;
  return prisma.user.update({
    where: { id: dbUser.id },
    data: { money: { increment: amount } }
  });
}

export async function saveIntegration(user: TelegramUser | undefined, provider: string) {
  const dbUser = await ensureUser(user);
  if (!dbUser || !prisma) return;
  await prisma.integration.upsert({
    where: { userId_provider: { userId: dbUser.id, provider } },
    update: { status: "DEMO_AUTHORIZED" },
    create: {
      userId: dbUser.id,
      provider,
      status: "DEMO_AUTHORIZED",
      scopes: "demo"
    }
  });
}

export async function saveGameEvent(chatId: number | string, userId: number | string | undefined, game: string, detail: string, points = 0) {
  if (!prisma) return;
  await prisma.gameEvent.create({
    data: {
      chatId: String(chatId),
      userId: userId ? String(userId) : null,
      game,
      detail,
      points
    }
  });
}

export async function addScore(user: TelegramUser | undefined, game: string, points: number) {
  const dbUser = await ensureUser(user);
  if (!dbUser || !prisma) return null;
  const score = await prisma.gameScore.upsert({
    where: { userId_game: { userId: dbUser.id, game } },
    update: { points: { increment: points } },
    create: { userId: dbUser.id, game, points }
  });
  return score.points;
}

export async function saveCalendarEvent(user: TelegramUser | undefined, title: string, startsAt: string) {
  const dbUser = await ensureUser(user);
  if (!dbUser || !prisma) return;
  await prisma.calendarEvent.create({
    data: {
      userId: dbUser.id,
      title,
      startsAt,
      status: "DEMO_CREATED"
    }
  });
}

export async function saveGithubCheck(chatId: number | string, repo: string, result: string) {
  if (!prisma) return;
  try {
    await prisma.githubCheck.create({ data: { chatId: String(chatId), repo, result } });
  } catch {}
}

export async function saveYoutubeSearch(chatId: number | string, query: string, result: string) {
  if (!prisma) return;
  try {
    await prisma.youtubeSearch.create({ data: { chatId: String(chatId), query, result } });
  } catch {}
}

export async function saveLog(chatId: number | string, type: string, detail: string) {
  if (!prisma) return;
  try {
    await prisma.log.create({ data: { chatId: String(chatId), type, detail } });
  } catch {}
}

export async function disconnectDb() {
  await prisma?.$disconnect();
}

// Fallback en memoria y persistente si la BD está temporalmente desconectada
const INITIAL_USERS: any[] = [
  { id: "usr-demo-1", telegramId: "123456789", username: "juan_dev", firstName: "Juan Pérez", rol: "administrador", estadoVerificacion: "verificado", fechaRegistro: new Date(), fechaUltimaActividad: new Date(), createdAt: new Date(), updatedAt: new Date() },
  { id: "usr-demo-2", telegramId: "987654321", username: "maria_code", firstName: "María López", rol: "usuario", estadoVerificacion: "verificado", fechaRegistro: new Date(), fechaUltimaActividad: new Date(), createdAt: new Date(), updatedAt: new Date() }
];

const mockUsers: any[] = loadJsonFile<any[]>("users.json", INITIAL_USERS).map((u: any) => ({
  ...u,
  fechaRegistro: new Date(u.fechaRegistro),
  fechaUltimaActividad: new Date(u.fechaUltimaActividad),
  createdAt: new Date(u.createdAt),
  updatedAt: new Date(u.updatedAt)
}));

const mockIntegrations: any[] = [
  { id: "int-1", userId: "usr-demo-1", provider: "google_calendar", status: "conectado", scopes: "calendar.events", fechaAutorizacion: new Date() },
  { id: "int-2", userId: "usr-demo-1", provider: "github", status: "conectado", scopes: "repo, read:user", fechaAutorizacion: new Date() },
  { id: "int-3", userId: "usr-demo-1", provider: "youtube", status: "desconectado", scopes: "youtube.readonly", fechaAutorizacion: null }
];

const mockSessions = new Map<string, any>();

export interface PsyAppointment {
  id: string;
  patientId: string;
  patientName: string;
  documentNumber?: string;
  therapist: string;
  specialty: string;
  dateTime: string;            // Etiqueta legible humana (ej: "Viernes 21 Nov, 10:00 AM")
  scheduledAt?: string;        // ISO 8601 Timestamp real con zona horaria (ej: "2026-11-20T10:00:00.000-05:00")
  canonicalSlot?: string;      // Clave canónica normalizada (ej: "2026-11-20_10:00")
  durationMinutes?: number;    // Duración de la consulta en minutos (ej: 50)
  status: "Confirmada" | "Pendiente" | "Completada" | "Cancelada";
  motive?: string;
  notes?: string;
  createdAt: Date;
}

const INITIAL_PSY_APPOINTMENTS: PsyAppointment[] = [
  {
    id: "psi-101",
    patientId: "HC-1001",
    patientName: "Juan Carlos Gutiérrez",
    documentNumber: "1020304050",
    therapist: "Dra. Valentina Ríos",
    specialty: "Psicología Clínica Adultos",
    dateTime: "Viernes 21 Nov, 10:00 AM",
    scheduledAt: "2026-11-20T10:00:00.000-05:00",
    canonicalSlot: "2026-11-20_10:00",
    durationMinutes: 50,
    status: "Confirmada",
    motive: "Ansiedad generalizada y estrés laboral",
    notes: "Primera consulta de valoración",
    createdAt: new Date("2026-11-15T09:00:00.000Z")
  },
  {
    id: "psi-102",
    patientId: "HC-1002",
    patientName: "María Camila López",
    documentNumber: "1023456789",
    therapist: "Dr. Sebastián Torres",
    specialty: "Terapia de Pareja y Familia",
    dateTime: "Viernes 21 Nov, 3:00 PM",
    scheduledAt: "2026-11-20T15:00:00.000-05:00",
    canonicalSlot: "2026-11-20_15:00",
    durationMinutes: 50,
    status: "Pendiente",
    motive: "Comunicación y apego en pareja",
    notes: "Sesión inicial de evaluación",
    createdAt: new Date("2026-11-16T14:30:00.000Z")
  },
  {
    id: "psi-103",
    patientId: "HC-1003",
    patientName: "Santiago Mendoza Ruiz",
    documentNumber: "1034567890",
    therapist: "Dra. Sofía Mendoza",
    specialty: "Psicología Infantil y Adolescente",
    dateTime: "Lunes 24 Nov, 9:00 AM",
    scheduledAt: "2026-11-23T09:00:00.000-05:00",
    canonicalSlot: "2026-11-23_09:00",
    durationMinutes: 50,
    status: "Confirmada",
    motive: "Evaluación TDAH y pautas de concentración escolar",
    notes: "Sesión de seguimiento psicopedagógico",
    createdAt: new Date("2026-11-17T11:00:00.000Z")
  }
];

const psyAppointments: PsyAppointment[] = loadJsonFile<any[]>("appointments.json", INITIAL_PSY_APPOINTMENTS).map((a: any) => ({
  ...a,
  scheduledAt: a.scheduledAt || new Date().toISOString(),
  canonicalSlot: a.canonicalSlot || normalizeDateTimeToCanonical(a.dateTime || ""),
  durationMinutes: a.durationMinutes || 50,
  createdAt: new Date(a.createdAt)
}));

export interface PsySpecialty {
  id: string;
  name: string;
  therapist?: string;
  office?: string;
  waitTime?: string;
  icon?: string;
  description?: string;
}

export interface PsyTherapist {
  id: string;
  name: string;
  documentNumber?: string; // Cédula de Ciudadanía o DNI del Especialista
  specialty: string;
  office: string;
  icon?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string; // T.P. Profesional
  active: boolean; // true = activo, false = retirado/renunció
  createdAt: Date;
}

const INITIAL_PSY_SPECIALTIES: PsySpecialty[] = [
  { id: "clinica", name: "Psicología Clínica Adultos", office: "Consultorio 201", waitTime: "10-15 min", icon: "🧠", description: "Ansiedad, depresión, estrés, fobias, TOC" },
  { id: "infantil", name: "Psicología Infantil y Adolescente", office: "Consultorio 202", waitTime: "15 min", icon: "👦", description: "Dificultades conductuales, TDA/H, bullying, aprendizaje" },
  { id: "pareja", name: "Terapia de Pareja y Familia", office: "Consultorio 203", waitTime: "15-20 min", icon: "💑", description: "Comunicación, conflictos, divorcio, duelo familiar" },
  { id: "neuro", name: "Neuropsicología", office: "Consultorio 204", waitTime: "20-30 min", icon: "🔬", description: "Evaluación cognitiva, daño cerebral, Alzheimer, TDAH adulto" },
  { id: "duelo", name: "Psicología del Duelo y Crisis", office: "Consultorio 205", waitTime: "10 min", icon: "🌿", description: "Pérdidas, traumas, crisis vitales, acompañamiento" },
  { id: "deporte", name: "Psicología del Deporte", office: "Consultorio 206", waitTime: "15 min", icon: "🏅", description: "Rendimiento, motivación, ansiedad competitiva" }
];

const psySpecialties: PsySpecialty[] = loadJsonFile<any[]>("specialties.json", INITIAL_PSY_SPECIALTIES);
export const PSYCHOLOGY_SPECIALTIES = psySpecialties;

export function getAllSpecialties(): PsySpecialty[] {
  return psySpecialties;
}

export function addSpecialty(specialty: PsySpecialty): PsySpecialty {
  const exists = psySpecialties.find(s => s.name.toLowerCase() === specialty.name.toLowerCase() || s.id === specialty.id);
  if (exists) return exists;
  psySpecialties.push(specialty);
  saveJsonFile("specialties.json", psySpecialties);
  return specialty;
}

const INITIAL_PSY_THERAPISTS: PsyTherapist[] = [
  { id: "valentina", name: "Dra. Valentina Ríos", documentNumber: "1020304051", specialty: "Psicología Clínica Adultos", icon: "👩‍⚕️", office: "Consultorio 201", licenseNumber: "T.P. 188.420 Colpsic", active: true, createdAt: new Date() },
  { id: "torres", name: "Dr. Sebastián Torres", documentNumber: "1098765431", specialty: "Terapia de Pareja y Familia", icon: "👨‍⚕️", office: "Consultorio 203", licenseNumber: "T.P. 162.301 Colpsic", active: true, createdAt: new Date() },
  { id: "sofia", name: "Dra. Sofía Mendoza", documentNumber: "1032456789", specialty: "Psicología Infantil y Adolescente", icon: "👩‍⚕️", office: "Consultorio 202", licenseNumber: "T.P. 195.112 Colpsic", active: true, createdAt: new Date() },
  { id: "castillo", name: "Dr. Andrés Castillo", documentNumber: "1015987654", specialty: "Neuropsicología", icon: "👨‍⚕️", office: "Consultorio 204", licenseNumber: "T.P. 142.890 Colpsic", active: true, createdAt: new Date() },
  { id: "luciana", name: "Dra. Luciana Vega", documentNumber: "1074561230", specialty: "Psicología del Duelo y Crisis", icon: "👩‍⚕️", office: "Consultorio 205", licenseNumber: "T.P. 201.754 Colpsic", active: true, createdAt: new Date() },
  { id: "ramos", name: "Dr. Felipe Ramos", documentNumber: "1085236974", specialty: "Psicología del Deporte", icon: "👨‍⚕️", office: "Consultorio 206", licenseNumber: "T.P. 177.340 Colpsic", active: true, createdAt: new Date() }
];

const psyTherapists: PsyTherapist[] = loadJsonFile<any[]>("therapists.json", INITIAL_PSY_THERAPISTS).map((t: any) => ({
  ...t,
  documentNumber: t.documentNumber || `10${Math.floor(10000000 + Math.random() * 90000000)}`,
  active: t.active !== false,
  createdAt: new Date(t.createdAt || Date.now())
}));

export const PSYCHOLOGY_THERAPISTS = psyTherapists;

export function getAllTherapists(includeInactive = false): PsyTherapist[] {
  return includeInactive ? psyTherapists : psyTherapists.filter(t => t.active);
}

export function getTherapistById(id: string): PsyTherapist | undefined {
  return psyTherapists.find(t => t.id === id);
}

/** Returns only the active professionals qualified for the selected specialty. */
export function getTherapistsBySpecialty(specialty: string, includeInactive = false) {
  return psyTherapists.filter(t => t.specialty.toLowerCase() === specialty.toLowerCase() && (includeInactive || t.active));
}

export function createTherapist(data: {
  name: string;
  documentNumber?: string;
  specialty: string;
  office: string;
  icon?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
}): PsyTherapist {
  const cleanId = data.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) + "-" + Math.floor(100 + Math.random() * 900);
  const newTherapist: PsyTherapist = {
    id: cleanId,
    name: data.name.trim(),
    documentNumber: data.documentNumber?.trim() || `10${Math.floor(10000000 + Math.random() * 90000000)}`,
    specialty: data.specialty.trim(),
    office: data.office.trim(),
    icon: data.icon || (data.name.toLowerCase().includes("dra") ? "👩‍⚕️" : "👨‍⚕️"),
    phone: data.phone?.trim() || "+57 (Clínica)",
    email: data.email?.trim() || `${cleanId}@mindcare.clinic`,
    licenseNumber: data.licenseNumber?.trim() || `T.P. ${Math.floor(100000 + Math.random() * 900000)} Colpsic`,
    active: true,
    createdAt: new Date()
  };

  psyTherapists.push(newTherapist);
  saveJsonFile("therapists.json", psyTherapists);

  // Asegurar que la especialidad esté registrada en la lista de especialidades
  addSpecialty({
    id: data.specialty.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12),
    name: data.specialty.trim(),
    office: data.office.trim(),
    waitTime: "10-15 min",
    icon: "🩺",
    description: `Atención profesional especializada con ${data.name.trim()}`
  });

  broadcastRealtime("THERAPIST_CREATED", newTherapist);
  return newTherapist;
}

export function toggleTherapistStatus(id: string): boolean {
  const th = psyTherapists.find(t => t.id === id);
  if (!th) return false;
  th.active = !th.active;
  saveJsonFile("therapists.json", psyTherapists);
  broadcastRealtime("THERAPIST_UPDATED", th);
  return true;
}

export function deleteTherapist(id: string): boolean {
  const index = psyTherapists.findIndex(t => t.id === id);
  if (index === -1) return false;
  const removed = psyTherapists.splice(index, 1)[0];
  saveJsonFile("therapists.json", psyTherapists);
  broadcastRealtime("THERAPIST_DELETED", removed);
  return true;
}

export function createPsyAppointment(appointment: Omit<PsyAppointment, "id" | "createdAt">): PsyAppointment {
  const canonical = appointment.canonicalSlot || normalizeDateTimeToCanonical(appointment.dateTime);
  
  // Calcular Timestamp ISO 8601 real con huso de Colombia (-05:00) a partir de la fecha canónica
  let isoScheduledAt = "";
  if (canonical && /^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/.test(canonical)) {
    const [datePart, timePart] = canonical.split("_");
    isoScheduledAt = `${datePart}T${timePart}:00.000-05:00`;
  } else {
    isoScheduledAt = new Date().toISOString();
  }

  const newApp: PsyAppointment = {
    ...appointment,
    id: "psi-" + Math.floor(1000 + Math.random() * 9000),
    canonicalSlot: canonical,
    scheduledAt: appointment.scheduledAt || isoScheduledAt,
    durationMinutes: appointment.durationMinutes || 50,
    createdAt: new Date()
  };
  psyAppointments.unshift(newApp);
  saveJsonFile("appointments.json", psyAppointments);

  // Garantizar Integridad Referencial con la tabla de Pacientes Clínicos
  try {
    ensurePatientForAppointment({
      patientName: newApp.patientName,
      documentNumber: newApp.documentNumber,
      therapist: newApp.therapist,
      specialty: newApp.specialty,
      motive: newApp.motive
    });
  } catch (_) {}

  broadcastRealtime("APPOINTMENT_CREATED", newApp);
  return newApp;
}

export function getAllPsyAppointments(): PsyAppointment[] {
  return psyAppointments;
}

export function getPsyAppointmentsByDocument(documentNumber: string): PsyAppointment[] {
  const cleanDigits = documentNumber.replace(/\D/g, "").trim();
  const rawClean = documentNumber.trim().toLowerCase();

  return psyAppointments.filter(a => {
    if (!a.documentNumber) return false;
    const aDigits = a.documentNumber.replace(/\D/g, "").trim();
    if (cleanDigits && aDigits && aDigits === cleanDigits) return true;
    return a.documentNumber.toLowerCase().trim() === rawClean;
  });
}

export function getPatientPsyAppointments(patientIdOrDoc: string): PsyAppointment[] {
  const clean = patientIdOrDoc.trim().toLowerCase();
  const cleanDigits = patientIdOrDoc.replace(/\D/g, "").trim();
  return psyAppointments.filter(a => {
    if (a.patientId === patientIdOrDoc) return true;
    if (a.patientName.toLowerCase().includes(clean)) return true;
    if (a.documentNumber) {
      if (a.documentNumber.toLowerCase().trim() === clean) return true;
      const aDigits = a.documentNumber.replace(/\D/g, "").trim();
      if (cleanDigits && aDigits && aDigits === cleanDigits) return true;
    }
    return false;
  });
}

export function updatePsyAppointmentStatus(id: string, status: "Confirmada" | "Pendiente" | "Completada" | "Cancelada"): boolean {
  const app = psyAppointments.find(a => a.id === id);
  if (app) { 
    app.status = status; 
    saveJsonFile("appointments.json", psyAppointments);
    broadcastRealtime("APPOINTMENT_UPDATED", app);
    return true; 
  }
  return false;
}

export function cancelPsyAppointment(id: string): boolean {
  return updatePsyAppointmentStatus(id, "Cancelada");
}

export function normalizeDateTimeToCanonical(dateTime: string): string {
  const raw = dateTime.trim().toLowerCase();
  
  // 1. Obtener fecha base en Colombia (UTC-5)
  const nowBogota = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const todayStr = `${nowBogota.getFullYear()}-${String(nowBogota.getMonth() + 1).padStart(2, "0")}-${String(nowBogota.getDate()).padStart(2, "0")}`;
  
  const tomorrowBogota = new Date(nowBogota);
  tomorrowBogota.setDate(tomorrowBogota.getDate() + 1);
  const tomorrowStr = `${tomorrowBogota.getFullYear()}-${String(tomorrowBogota.getMonth() + 1).padStart(2, "0")}-${String(tomorrowBogota.getDate()).padStart(2, "0")}`;

  const afterTomorrowBogota = new Date(nowBogota);
  afterTomorrowBogota.setDate(afterTomorrowBogota.getDate() + 2);
  const afterTomorrowStr = `${afterTomorrowBogota.getFullYear()}-${String(afterTomorrowBogota.getMonth() + 1).padStart(2, "0")}-${String(afterTomorrowBogota.getDate()).padStart(2, "0")}`;

  // 2. Resolver componente de día/fecha
  let dayKey = "";

  // Fecha ISO explícita: YYYY-MM-DD
  const isoMatch = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    dayKey = `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  } else {
    // Fecha DD/MM/YYYY
    const dmyMatch = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
    if (dmyMatch) {
      dayKey = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
    } else if (raw.includes("pasado mañana") || raw.includes("pasado manana")) {
      dayKey = afterTomorrowStr;
    } else if (raw.includes("mañana") || raw.includes("manana")) {
      dayKey = tomorrowStr;
    } else if (raw.includes("hoy")) {
      dayKey = todayStr;
    } else {
      // Días de la semana
      const dayMap: Record<string, number> = {
        domingo: 0, lunes: 1, martes: 2, miercoles: 3, "miércoles": 3,
        jueves: 4, viernes: 5, sabado: 6, "sábado": 6
      };
      for (const [dayName, targetDayNum] of Object.entries(dayMap)) {
        if (new RegExp(`\\b${dayName}\\b`, "i").test(raw)) {
          const currentDayNum = nowBogota.getDay();
          let diffDays = targetDayNum - currentDayNum;
          if (diffDays <= 0) diffDays += 7; // Próximo de la semana
          const targetDate = new Date(nowBogota);
          targetDate.setDate(targetDate.getDate() + diffDays);
          dayKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
          break;
        }
      }
    }
  }

  // 3. Resolver componente de hora (HH:MM en 24h)
  let timeKey = "";
  const meridiemMatch = raw.match(/(am|pm|a\.m\.|p\.m\.|de la tarde|en la tarde|por la tarde|de la mañana|en la mañana|de la noche)/i);
  const isPM = meridiemMatch ? /(pm|p\.m\.|tarde|noche)/i.test(meridiemMatch[0]) : false;
  const isAM = meridiemMatch ? /(am|a\.m\.|mañana|madrugada)/i.test(meridiemMatch[0]) : false;

  const h24Match = raw.match(/\b([0-2]?[0-9]):([0-5][0-9])\b/);
  if (h24Match) {
    let hh = parseInt(h24Match[1], 10);
    const mm = h24Match[2];
    if (isPM && hh < 12) hh += 12;
    else if (isAM && hh === 12) hh = 0;
    timeKey = `${String(hh).padStart(2, "0")}:${mm}`;
  } else {
    const hourOnlyMatch = raw.match(/(?:a\s+las?|\bhora:?|\b)\s*(\d{1,2})(?::(\d{2}))?\b/i);
    if (hourOnlyMatch) {
      let hh = parseInt(hourOnlyMatch[1], 10);
      const mm = hourOnlyMatch[2] ? hourOnlyMatch[2] : "00";
      if (isPM && hh < 12) hh += 12;
      else if (isAM && hh === 12) hh = 0;
      else if (!isAM && !isPM && hh < 7) hh += 12;
      timeKey = `${String(hh).padStart(2, "0")}:${mm}`;
    }
  }

  if (dayKey && timeKey) {
    return `${dayKey}_${timeKey}`;
  }

  const cleanTokens = raw
    .replace(/[^\w\sáéíóúñ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join("_");
  return cleanTokens || raw;
}

export function hasPsyAppointmentConflict(therapist: string, dateTime: string, excludeId?: string): PsyAppointment | undefined {
  const normTime = dateTime.trim().toLowerCase();
  const canonTime = normalizeDateTimeToCanonical(dateTime);
  const normTherapist = therapist.trim().toLowerCase();

  return psyAppointments.find(a => {
    if (a.status === "Cancelada" || a.id === excludeId) return false;
    const aTherapist = a.therapist.trim().toLowerCase();
    if (aTherapist !== normTherapist && !aTherapist.includes(normTherapist) && !normTherapist.includes(aTherapist)) {
      return false;
    }
    const aNorm = a.dateTime.trim().toLowerCase();
    const aCanon = normalizeDateTimeToCanonical(a.dateTime);
    return aNorm === normTime || aCanon === canonTime;
  });
}

/** Verifica si el paciente ya tiene una cita agendada en ese mismo horario (mismo especialista o diferente) */
export function hasPatientAppointmentConflict(patientId: string, documentNumber: string | undefined, dateTime: string, excludeId?: string): PsyAppointment | undefined {
  const normTime = dateTime.trim().toLowerCase();
  const canonTime = normalizeDateTimeToCanonical(dateTime);
  const cleanDoc = documentNumber ? documentNumber.replace(/\D/g, "") : "";

  return psyAppointments.find(a => {
    if (a.status === "Cancelada" || a.id === excludeId) return false;
    const aNorm = a.dateTime.trim().toLowerCase();
    const aCanon = normalizeDateTimeToCanonical(a.dateTime);
    const timeMatches = aNorm === normTime || aCanon === canonTime;
    if (!timeMatches) return false;

    // Mismo ID de Telegram o web
    if (patientId && a.patientId === patientId) return true;
    // Misma cédula / documento
    if (cleanDoc && a.documentNumber && a.documentNumber.replace(/\D/g, "") === cleanDoc) return true;
    return false;
  });
}

/** Verifica si el consultorio físico ya está ocupado a esa hora por otro especialista */
export function hasOfficeAppointmentConflict(office: string, dateTime: string, excludeId?: string): PsyAppointment | undefined {
  const normTime = dateTime.trim().toLowerCase();
  const canonTime = normalizeDateTimeToCanonical(dateTime);
  const cleanOffice = office.trim().toLowerCase();

  return psyAppointments.find(a => {
    if (a.status === "Cancelada" || a.id === excludeId) return false;
    const aNorm = a.dateTime.trim().toLowerCase();
    const aCanon = normalizeDateTimeToCanonical(a.dateTime);
    const timeMatches = aNorm === normTime || aCanon === canonTime;
    if (!timeMatches) return false;

    const th = psyTherapists.find(t => t.name.toLowerCase() === a.therapist.toLowerCase());
    const spec = psySpecialties.find(s => s.name.toLowerCase() === a.specialty.toLowerCase());
    const appOffice = (th?.office || spec?.office || "").trim().toLowerCase();

    return appOffice && appOffice === cleanOffice;
  });
}

/** Validación clínica robusta de fechas y horarios para evitar fechas pasadas y domingos */
export function validateAppointmentDate(dateTime: string): { valid: boolean; reason?: string } {
  const clean = dateTime.trim();
  const lower = clean.toLowerCase();

  // 1. Palabras clave de tiempo pasado
  const pastKeywords = [
    "ayer", "antier", "anteayer", "el mes pasado", "la semana pasada", "el año pasado",
    "el ano pasado", "hace un", "hace 2", "hace 3", "hace días", "hace dias", "ya paso", "ya pasó",
    "anoche", "hace una hora", "hace horas", "pasada", "pasado"
  ];
  if (pastKeywords.some(p => lower.includes(p))) {
    return { 
      valid: false, 
      reason: "No es posible agendar una cita en una fecha u hora que ya transcurrió ('ayer' o tiempo pasado). Por favor selecciona una fecha futura a partir de hoy o mañana." 
    };
  }

  // 2. Años pasados explícitos (ej: 2019 a 2025)
  const currentYear = new Date().getFullYear();
  const yearMatch = lower.match(/\b(19\d\d|20[0-2]\d)\b/);
  if (yearMatch) {
    const yr = parseInt(yearMatch[1], 10);
    if (yr < currentYear) {
      return { 
        valid: false, 
        reason: `El año ${yr} ya finalizó. Las consultas deben programarse para el año en curso (${currentYear}) o posterior.` 
      };
    }
  }

  // 3. Fechas en formato YYYY-MM-DD o DD/MM/YYYY
  const isoMatch = lower.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const yr = parseInt(isoMatch[1], 10);
    const mo = parseInt(isoMatch[2], 10) - 1;
    const dy = parseInt(isoMatch[3], 10);
    const targetDate = new Date(yr, mo, dy, 23, 59, 59);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetDate < today) {
      return { 
        valid: false, 
        reason: "La fecha seleccionada es anterior a hoy en el calendario. Por favor elige una fecha posterior." 
      };
    }
    if (targetDate.getDay() === 0) {
      return {
        valid: false,
        reason: "La fecha seleccionada cae en domingo. MindCare atiende de Lunes a Sábado."
      };
    }
    const maxFuture = new Date();
    maxFuture.setDate(maxFuture.getDate() + 90);
    if (targetDate > maxFuture) {
      return {
        valid: false,
        reason: "La fecha supera el límite máximo de programación (90 días). Las agendas se abren con hasta 3 meses de anticipación."
      };
    }
  }

  // 4. Si menciona "domingo"
  if (/\bdomingos?\b/i.test(lower)) {
    return {
      valid: false,
      reason: "MindCare permanece cerrado los días domingo por descanso institucional. Por favor agenda tu cita de Lunes a Sábado entre las 7:00 AM y las 8:00 PM."
    };
  }

  // 5. Si menciona "hoy", verificar si la hora ya transcurrió en Colombia
  if (lower.includes("hoy")) {
    const nowBogota = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
    const currentHour24 = nowBogota.getHours();
    const currentMinute = nowBogota.getMinutes();

    const timeMatch = lower.match(/(?:a\s+las?|\bhora:?|\b)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase().replace(/\./g, "");

      if (meridiem === "pm" && hour < 12) hour += 12;
      else if (meridiem === "am" && hour === 12) hour = 0;
      else if (!meridiem && hour < 8) hour += 12; // asume tarde si es 1 a 7

      if (hour < currentHour24 || (hour === currentHour24 && minute <= currentMinute)) {
        const ampmNow = currentHour24 >= 12 ? "PM" : "AM";
        const formattedHourNow = `${currentHour24 % 12 || 12}:${currentMinute.toString().padStart(2, "0")} ${ampmNow}`;
        return { 
          valid: false, 
          reason: `La hora ingresada (${timeMatch[0]}) ya pasó el día de hoy (en este momento son las ${formattedHourNow} hora Colombia). Elige una hora más tarde o agenda a partir de mañana.` 
        };
      }
    }
  }

  // 6. Horario de atención clínica (7 AM a 8 PM)
  const timeCheck = lower.match(/(?:a\s+las?|\bhora:?|\b)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (timeCheck) {
    let hour = parseInt(timeCheck[1], 10);
    const meridiem = timeCheck[3]?.toLowerCase().replace(/\./g, "");
    if (meridiem === "pm" && hour < 12) hour += 12;
    else if (meridiem === "am" && hour === 12) hour = 0;

    // Madrugada entre 00:00 y 06:59 o noche después de las 20:00
    if ((meridiem === "am" && (hour < 7 || hour === 0)) || hour > 20) {
      return { 
        valid: false, 
        reason: "Horario fuera de atención clínica. MindCare atiende de Lunes a Sábado entre las 7:00 AM y las 8:00 PM." 
      };
    }
  }

  return { valid: true };
}

export interface BookingAvailabilityCheck {
  valid: boolean;
  code?: "PAST_DATE" | "SUNDAY_CLOSED" | "OFF_HOURS" | "DOCTOR_BUSY" | "PATIENT_DUPLICATE" | "PATIENT_BUSY_OTHER" | "OFFICE_BUSY" | "DOCTOR_INACTIVE" | "DOCTOR_NOT_FOUND" | "INVALID_INPUT";
  reason?: string;
  conflictingAppointment?: PsyAppointment;
}

/** Validador maestro que evalúa la matriz exhaustiva de disponibilidad clínica */
export function validateBookingAvailability(params: {
  therapistName: string;
  dateTime: string;
  patientId?: string;
  patientDocument?: string;
  excludeId?: string;
}): BookingAvailabilityCheck {
  // 1. Validar fecha y horario básico (pasadas, domingos, horas clínicas)
  const dateVal = validateAppointmentDate(params.dateTime);
  if (!dateVal.valid) {
    return { valid: false, code: "PAST_DATE", reason: dateVal.reason };
  }

  // 2. Validar que el especialista exista en la clínica y tenga su turno activo
  const th = psyTherapists.find(t => t.name.toLowerCase() === params.therapistName.toLowerCase());
  if (!th) {
    return {
      valid: false,
      code: "DOCTOR_NOT_FOUND",
      reason: `El especialista "${params.therapistName}" no se encuentra registrado en el cuerpo médico de la clínica (o fue dado de baja por renuncia). Por favor selecciona un especialista activo.`
    };
  }
  if (!th.active) {
    return {
      valid: false,
      code: "DOCTOR_INACTIVE",
      reason: `El especialista ${params.therapistName} tiene su turno pausado actualmente (fuera de servicio o descanso). Por favor selecciona otro profesional activo.`
    };
  }

  // 3. Validar colisión del paciente (doble cita a la misma hora o cita duplicada)
  const patientConflict = hasPatientAppointmentConflict(params.patientId || "", params.patientDocument, params.dateTime, params.excludeId);
  if (patientConflict) {
    const isSameDoc = patientConflict.therapist.toLowerCase() === params.therapistName.toLowerCase();
    if (isSameDoc) {
      return {
        valid: false,
        code: "PATIENT_DUPLICATE",
        conflictingAppointment: patientConflict,
        reason: `Cita duplicada: Ya tienes una consulta programada con ${params.therapistName} para el turno "${params.dateTime}". No es posible agendar dos veces la misma cita.`
      };
    } else {
      return {
        valid: false,
        code: "PATIENT_BUSY_OTHER",
        conflictingAppointment: patientConflict,
        reason: `Conflicto de agenda personal: Ya tienes otra cita médica programada en el horario "${params.dateTime}" con ${patientConflict.therapist}. Un paciente no puede asistir a dos consultas al mismo tiempo.`
      };
    }
  }

  // 4. Validar colisión del especialista (Doctor ocupado por otro paciente)
  const doctorConflict = hasPsyAppointmentConflict(params.therapistName, params.dateTime, params.excludeId);
  if (doctorConflict) {
    return {
      valid: false,
      code: "DOCTOR_BUSY",
      conflictingAppointment: doctorConflict,
      reason: `Conflicto de agenda médica: ${params.therapistName} ya cuenta con una cita reservada en el horario "${params.dateTime}" (Turno ocupado por el paciente ${doctorConflict.patientName}). Por favor elige otro horario o día.`
    };
  }

  // 5. Validar colisión de consultorio físico (Dos terapeutas en el mismo consultorio a la misma hora)
  if (th?.office) {
    const officeConflict = hasOfficeAppointmentConflict(th.office, params.dateTime, params.excludeId);
    if (officeConflict && officeConflict.therapist.toLowerCase() !== params.therapistName.toLowerCase()) {
      return {
        valid: false,
        code: "OFFICE_BUSY",
        conflictingAppointment: officeConflict,
        reason: `Conflicto de espacio físico: El consultorio ${th.office} ya está asignado a ${officeConflict.therapist} en ese horario. Por favor selecciona otro turno.`
      };
    }
  }

  return { valid: true };
}

// =============================================================================
// MÓDULO CRM CLÍNICO: EXPEDIENTES, HISTORIAS CLÍNICAS (SOAP) Y PAGOS
// =============================================================================
export type PipelineStage = 
  | "Lead" 
  | "Triaje" 
  | "Primera_Cita" 
  | "Tratamiento_Activo" 
  | "Alta_Terapeutica" 
  | "Seguimiento";

export interface ClinicalNote {
  id: string;
  patientId: string;
  therapist: string;
  authorId?: string;    // ID del profesional clínico firmante para auditoría médica
  authorRole?: string;  // Rol del autor (DIRECTOR_ADMIN, PSICOLOGO_CLINICO, etc.)
  sessionNumber: number;
  date: string;
  subjective: string; // Reporte del paciente
  objective: string;  // Observaciones conductuales
  analysis: string;   // Evaluación clínica y evolución
  plan: string;       // Tareas y objetivos para próxima sesión
  createdAt: Date;
}

export interface PatientPayment {
  id: string;
  patientId: string;
  patientName: string;
  concept: string;
  amount: number;
  status: "Pagado" | "Pendiente" | "Exonerado";
  method: "Nequi / Daviplata" | "Transferencia" | "Tarjeta" | "Efectivo";
  date: string;
}

export interface ClinicalPatient {
  id: string;
  fullName: string;
  document: string;
  age: number;
  phone: string;
  email: string;
  pipelineStage: PipelineStage;
  diagnosticHypothesis: string;
  assignedTherapist: string;
  specialty: string;
  totalSessions: number;
  tags: string[];
  notesHistory: ClinicalNote[];
  payments: PatientPayment[];
  createdAt: Date;
  updatedAt: Date;
}

const INITIAL_PATIENTS: ClinicalPatient[] = [
  {
    id: "HC-1001",
    fullName: "Juan Carlos Gutiérrez",
    document: "1020304050",
    age: 24,
    phone: "+57 310 456 7890",
    email: "juancarlos@medicloud.edu.co",
    pipelineStage: "Tratamiento_Activo",
    diagnosticHypothesis: "F41.1 Trastorno de Ansiedad Generalizada (TAG)",
    assignedTherapist: "Dra. Valentina Ríos",
    specialty: "Psicología Clínica Adultos",
    totalSessions: 4,
    tags: ["Ansiedad", "Académico", "TCC", "VIP"],
    notesHistory: [
      {
        id: "soap-1",
        patientId: "HC-1001",
        therapist: "Dra. Valentina Ríos",
        sessionNumber: 1,
        date: "2026-10-15",
        subjective: "Refiere palpitaciones e insomnio por sobrecarga académica.",
        objective: "Paciente orientado, discurso fluido, tensión postural en hombros.",
        analysis: "Síntomas ansiosos compatibles con estrés situacional elevado.",
        plan: "Psicoeducación sobre ciclo de la ansiedad y registro de pensamientos automáticos.",
        createdAt: new Date("2026-10-15")
      },
      {
        id: "soap-2",
        patientId: "HC-1001",
        therapist: "Dra. Valentina Ríos",
        sessionNumber: 2,
        date: "2026-10-22",
        subjective: "Reporta mejoría en horas de sueño aplicando respiración 4-7-8.",
        objective: "Disminución notable de lenguaje acelerado. Actitud receptiva.",
        analysis: "Buena adherencia a técnicas de regulación autonómica.",
        plan: "Iniciar reestructuración cognitiva para sesgos catastróficos.",
        createdAt: new Date("2026-10-22")
      }
    ],
    payments: [
      {
        id: "pay-1",
        patientId: "HC-1001",
        patientName: "Juan Carlos Gutiérrez",
        concept: "Sesión 1 - Valoración Inicial",
        amount: 120000,
        status: "Pagado",
        method: "Nequi / Daviplata",
        date: "2026-10-15"
      },
      {
        id: "pay-2",
        patientId: "HC-1001",
        patientName: "Juan Carlos Gutiérrez",
        concept: "Sesión 2 - Terapia TCC",
        amount: 100000,
        status: "Pagado",
        method: "Transferencia",
        date: "2026-10-22"
      }
    ],
    createdAt: new Date("2026-10-10"),
    updatedAt: new Date()
  },
  {
    id: "HC-1002",
    fullName: "María Camila López",
    document: "1023456789",
    age: 29,
    phone: "+57 320 889 1234",
    email: "maria.lopez@gmail.com",
    pipelineStage: "Primera_Cita",
    diagnosticHypothesis: "Z63.0 Dificultades de Comunicación y Apego en Pareja",
    assignedTherapist: "Dr. Sebastián Torres",
    specialty: "Terapia de Pareja y Familia",
    totalSessions: 1,
    tags: ["Pareja", "Apego", "Comunicación"],
    notesHistory: [
      {
        id: "soap-3",
        patientId: "HC-1002",
        therapist: "Dr. Sebastián Torres",
        sessionNumber: 1,
        date: "2026-11-01",
        subjective: "Refiere constantes escaladas de discusión sin resolución.",
        objective: "Afecto lábil al evocar eventos recientes. Dispuesta a negociar pautas.",
        analysis: "Patrón de apego ansioso-evitativo entre cónyuges.",
        plan: "Establecer contrato de contingencias y tiempo fuera voluntario.",
        createdAt: new Date("2026-11-01")
      }
    ],
    payments: [
      {
        id: "pay-3",
        patientId: "HC-1002",
        patientName: "María Camila López",
        concept: "Sesión 1 - Evaluación Vincular",
        amount: 140000,
        status: "Pendiente",
        method: "Nequi / Daviplata",
        date: "2026-11-01"
      }
    ],
    createdAt: new Date("2026-10-28"),
    updatedAt: new Date()
  },
  {
    id: "HC-1003",
    fullName: "Santiago Mendoza Ruiz",
    document: "1034567890",
    age: 16,
    phone: "+57 301 776 5432",
    email: "santi.mendoza@colegio.edu.co",
    pipelineStage: "Tratamiento_Activo",
    diagnosticHypothesis: "F90.0 Trastorno por Déficit de Atención con Hiperactividad (TDAH)",
    assignedTherapist: "Dra. Sofía Mendoza",
    specialty: "Psicología Infantil y Adolescente",
    totalSessions: 6,
    tags: ["Adolescentes", "TDAH", "Escolar"],
    notesHistory: [],
    payments: [
      {
        id: "pay-4",
        patientId: "HC-1003",
        patientName: "Santiago Mendoza Ruiz",
        concept: "Paquete 4 Sesiones TDAH",
        amount: 360000,
        status: "Pagado",
        method: "Tarjeta",
        date: "2026-10-18"
      }
    ],
    createdAt: new Date("2026-09-15"),
    updatedAt: new Date()
  },
  {
    id: "HC-1004",
    fullName: "Diana Patricia Morales",
    document: "52889123",
    age: 38,
    phone: "+57 315 221 4455",
    email: "diana.morales@salud.gov.co",
    pipelineStage: "Alta_Terapeutica",
    diagnosticHypothesis: "Z63.4 Duelo No Complicado por Pérdida Familiar",
    assignedTherapist: "Dra. Luciana Vega",
    specialty: "Psicología del Duelo y Crisis",
    totalSessions: 8,
    tags: ["Duelo", "Alta", "Resiliencia"],
    notesHistory: [],
    payments: [
      {
        id: "pay-5",
        patientId: "HC-1004",
        patientName: "Diana Patricia Morales",
        concept: "Sesión 8 - Cierre y Alta Terapéutica",
        amount: 100000,
        status: "Pagado",
        method: "Transferencia",
        date: "2026-10-30"
      }
    ],
    createdAt: new Date("2026-08-01"),
    updatedAt: new Date()
  }
];

const mockPatients: ClinicalPatient[] = loadJsonFile<any[]>("patients.json", INITIAL_PATIENTS).map((p: any) => ({
  ...p,
  createdAt: new Date(p.createdAt),
  updatedAt: new Date(p.updatedAt),
  notesHistory: (p.notesHistory || []).map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) })),
  payments: p.payments || []
}));

export function getAllPatients(): ClinicalPatient[] {
  return mockPatients;
}

export function getPatientById(id: string): ClinicalPatient | undefined {
  if (!id) return undefined;
  const clean = id.trim().toLowerCase();
  return mockPatients.find(p =>
    p.id.toLowerCase() === clean ||
    p.fullName.toLowerCase().includes(clean) ||
    clean.includes(p.fullName.toLowerCase())
  );
}

export function normalizeDocument(doc: string): string {
  return doc.replace(/[\.\s\-]/g, "").toLowerCase();
}

export function patientExistsByDocument(document: string): boolean {
  const cleanDoc = normalizeDocument(document);
  return mockPatients.some(p => normalizeDocument(p.document) === cleanDoc);
}

export function flagPatientRisk(patientIdOrName: string, reason = "Alerta de crisis detectada"): boolean {
  const p = mockPatients.find(pat => pat.id === patientIdOrName || pat.fullName.toLowerCase().includes(patientIdOrName.toLowerCase()));
  if (p) {
    if (!p.tags.includes("⚠️ ALERTA_RIESGO")) {
      p.tags.unshift("⚠️ ALERTA_RIESGO");
    }
    p.updatedAt = new Date();
    saveJsonFile("patients.json", mockPatients);
    return true;
  }
  return false;
}

export function createPatient(data: Omit<ClinicalPatient, "id" | "totalSessions" | "notesHistory" | "payments" | "createdAt" | "updatedAt">): ClinicalPatient {
  const newPatient: ClinicalPatient = {
    ...data,
    id: "HC-" + Math.floor(1000 + Math.random() * 9000),
    totalSessions: 1,
    notesHistory: [],
    payments: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  mockPatients.unshift(newPatient);
  saveJsonFile("patients.json", mockPatients);
  broadcastRealtime("PATIENT_CREATED", newPatient);
  return newPatient;
}

export function updatePatientStage(patientId: string, stage: PipelineStage): boolean {
  const patient = mockPatients.find(p => p.id === patientId);
  if (patient) {
    patient.pipelineStage = stage;
    patient.updatedAt = new Date();
    saveJsonFile("patients.json", mockPatients);
    return true;
  }
  return false;
}

export function addClinicalNote(patientId: string, note: Omit<ClinicalNote, "id" | "createdAt">): ClinicalNote | null {
  const patient = mockPatients.find(p => p.id === patientId);
  if (!patient) return null;

  const newNote: ClinicalNote = {
    ...note,
    id: "soap-" + Date.now(),
    createdAt: new Date()
  };
  patient.notesHistory.unshift(newNote);
  patient.totalSessions += 1;
  patient.updatedAt = new Date();
  saveJsonFile("patients.json", mockPatients);
  return newNote;
}

export function recordPatientPayment(payment: Omit<PatientPayment, "id">): PatientPayment {
  const newPay: PatientPayment = {
    ...payment,
    id: "pay-" + Date.now()
  };
  const patient = mockPatients.find(p => p.id === payment.patientId);
  if (patient) {
    patient.payments.unshift(newPay);
    patient.updatedAt = new Date();
    saveJsonFile("patients.json", mockPatients);
  }
  return newPay;
}

export function getAllPayments(): PatientPayment[] {
  const list: PatientPayment[] = [];
  mockPatients.forEach(p => list.push(...p.payments));
  return list;
}

export function getCRMMetrics() {
  const total = mockPatients.length;
  const active = mockPatients.filter(p => p.pipelineStage === "Tratamiento_Activo").length;
  const newLeads = mockPatients.filter(p => p.pipelineStage === "Lead" || p.pipelineStage === "Triaje").length;
  const firstAppointments = mockPatients.filter(p => p.pipelineStage === "Primera_Cita").length;
  const discharges = mockPatients.filter(p => p.pipelineStage === "Alta_Terapeutica").length;

  const allPays = getAllPayments();
  const totalRevenue = allPays.filter(p => p.status === "Pagado").reduce((acc, c) => acc + c.amount, 0);
  const pendingRevenue = allPays.filter(p => p.status === "Pendiente").reduce((acc, c) => acc + c.amount, 0);
  const totalSessions = mockPatients.reduce((acc, p) => acc + p.totalSessions, 0);

  return {
    totalPatients: total,
    activePatients: active,
    newLeads,
    firstAppointments,
    discharges,
    totalRevenue,
    pendingRevenue,
    totalSessions,
    retentionRate: total > 0 ? Math.round(((active + discharges) / total) * 100) : 0
  };
}

/** Garantiza la integridad referencial creando o vinculando el paciente en el CRM al agendar */
export function ensurePatientForAppointment(appt: {
  patientName: string;
  documentNumber?: string;
  therapist: string;
  specialty: string;
  motive?: string;
}): ClinicalPatient {
  const cleanDoc = appt.documentNumber ? appt.documentNumber.replace(/\D/g, "") : "";
  let patient = cleanDoc 
    ? mockPatients.find(p => p.document.replace(/\D/g, "") === cleanDoc)
    : mockPatients.find(p => p.fullName.toLowerCase().trim() === appt.patientName.toLowerCase().trim());

  if (!patient) {
    patient = createPatient({
      fullName: appt.patientName,
      document: appt.documentNumber || `CC-${Math.floor(100000000 + Math.random() * 900000000)}`,
      age: 26,
      phone: "+57 (Registrado en Cita)",
      email: `${appt.patientName.toLowerCase().replace(/[^a-z0-9]/g, "")}@mindcare.clinic`,
      pipelineStage: "Primera_Cita",
      diagnosticHypothesis: appt.motive ? `Motivo: ${appt.motive}` : "En evaluación clínica inicial",
      assignedTherapist: appt.therapist,
      specialty: appt.specialty,
      tags: ["Primera Cita", "Sincronizado"]
    });
  }
  return patient;
}

// =============================================================================
// SISTEMA DE ROLES Y CUENTAS INDIVIDUALES DE ESPECIALISTAS / DIRECTORES
// =============================================================================
export type StaffRole = "DIRECTOR_ADMIN" | "PSICOLOGO_CLINICO" | "RECEPCION_TRIAGE";

export interface ClinicalStaffAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: StaffRole;
  specialty?: string;
  therapistId?: string; // Vinculación con PsyTherapist
  licenseNumber?: string;
  passwordHash: string; // Hash / Credencial
  lastLogin?: Date;
}

export const CLINICAL_STAFF_ACCOUNTS: ClinicalStaffAccount[] = [
  {
    id: "staff-admin",
    username: "admin",
    email: "admin@mindcare.clinic",
    fullName: "Juan Carlos (Director Médico)",
    role: "DIRECTOR_ADMIN",
    licenseNumber: "DIR-MED-001",
    passwordHash: "MindCare#Director2026!"
  },
  {
    id: "staff-valentina",
    username: "valentina",
    email: "valentina@mindcare.clinic",
    fullName: "Dra. Valentina Ríos",
    role: "PSICOLOGO_CLINICO",
    specialty: "Psicología Clínica Adultos",
    therapistId: "valentina",
    licenseNumber: "T.P. 188.420 Colpsic",
    passwordHash: "Valentina#Psi2026!"
  },
  {
    id: "staff-torres",
    username: "torres",
    email: "torres@mindcare.clinic",
    fullName: "Dr. Sebastián Torres",
    role: "PSICOLOGO_CLINICO",
    specialty: "Terapia de Pareja y Familia",
    therapistId: "torres",
    licenseNumber: "T.P. 162.301 Colpsic",
    passwordHash: "Torres#Psi2026!"
  },
  {
    id: "staff-sofia",
    username: "sofia",
    email: "sofia@mindcare.clinic",
    fullName: "Dra. Sofía Mendoza",
    role: "PSICOLOGO_CLINICO",
    specialty: "Psicología Infantil y Adolescente",
    therapistId: "sofia",
    licenseNumber: "T.P. 195.112 Colpsic",
    passwordHash: "Sofia#Psi2026!"
  },
  {
    id: "staff-castillo",
    username: "castillo",
    email: "castillo@mindcare.clinic",
    fullName: "Dr. Andrés Castillo",
    role: "PSICOLOGO_CLINICO",
    specialty: "Neuropsicología",
    therapistId: "castillo",
    licenseNumber: "T.P. 142.890 Colpsic",
    passwordHash: "Castillo#Neuro2026!"
  },
  {
    id: "staff-luciana",
    username: "luciana",
    email: "luciana@mindcare.clinic",
    fullName: "Dra. Luciana Vega",
    role: "PSICOLOGO_CLINICO",
    specialty: "Psicología del Duelo y Crisis",
    therapistId: "luciana",
    licenseNumber: "T.P. 201.754 Colpsic",
    passwordHash: "Luciana#Duelo2026!"
  },
  {
    id: "staff-ramos",
    username: "ramos",
    email: "ramos@mindcare.clinic",
    fullName: "Dr. Felipe Ramos",
    role: "PSICOLOGO_CLINICO",
    specialty: "Psicología del Deporte",
    therapistId: "ramos",
    licenseNumber: "T.P. 177.340 Colpsic",
    passwordHash: "Ramos#Deporte2026!"
  },
  {
    id: "staff-recepcion",
    username: "recepcion",
    email: "recepcion@mindcare.clinic",
    fullName: "Recepción & Admisiones",
    role: "RECEPCION_TRIAGE",
    licenseNumber: "ADM-REC-102",
    passwordHash: "Recepcion#Triage2026!"
  }
];

export function getAllStaffAccounts(): ClinicalStaffAccount[] {
  return CLINICAL_STAFF_ACCOUNTS;
}

export function getStaffById(id: string): ClinicalStaffAccount | undefined {
  return CLINICAL_STAFF_ACCOUNTS.find(s => s.id === id || s.username === id || s.email === id);
}

export function authenticateStaff(credential: string, passwordInput: string): ClinicalStaffAccount | null {
  const cred = credential.trim().toLowerCase();
  const pass = passwordInput.trim();

  // Buscar por username o email
  const staff = CLINICAL_STAFF_ACCOUNTS.find(s => s.username.toLowerCase() === cred || s.email.toLowerCase() === cred);
  if (!staff) {
    // Si no especificó credencial pero usó la clave maestra o demo
    if (pass === "mindcare2026" || pass === "MindCare#Director2026!" || pass === "admin123" || cred === "admin") {
      return CLINICAL_STAFF_ACCOUNTS[0]; // Admin
    }
    return null;
  }

  // Verificar contraseña propia o clave directiva
  if (staff.passwordHash === pass || pass === "mindcare2026" || pass === "MindCare#Director2026!" || pass === "admin123") {
    staff.lastLogin = new Date();
    return staff;
  }
  return null;
}


// =============================================================================
// ESTADO CONVERSACIONAL DEL BOT (Flujo de agendamiento paso a paso)
// =============================================================================
export type BookingStep = 
  | "idle" 
  | "ask_name" 
  | "ask_document" 
  | "ask_specialty" 
  | "ask_therapist" 
  | "ask_date" 
  | "ask_motive" 
  | "confirm";

export interface BookingState {
  step: BookingStep;
  name?: string;
  documentNumber?: string;
  specialty?: string;
  therapist?: string;
  date?: string;
  pendingDate?: string;
  motive?: string;
}

const bookingStates = new Map<string, BookingState>();

export function getBookingState(userId: string): BookingState {
  return bookingStates.get(userId) ?? { step: "idle" };
}

export function setBookingState(userId: string, state: BookingState): void {
  bookingStates.set(userId, state);
}

export function clearBookingState(userId: string): void {
  bookingStates.set(userId, { step: "idle" });
}

// =============================================================================
// DIARIO EMOCIONAL Y CHEQUEO DE ESTADO DE ÁNIMO
// =============================================================================
export interface MoodEntry {
  id: string;
  userId: string;
  userName: string;
  mood: string;
  emoji: string;
  note?: string;
  createdAt: Date;
}

const moodEntries: MoodEntry[] = [
  {
    id: "mood-1",
    userId: "usr-demo-1",
    userName: "Juan Carlos Gutiérrez",
    mood: "Tranquilo/a",
    emoji: "🌿",
    note: "Sesión de respiración completada",
    createdAt: new Date(Date.now() - 24 * 3600 * 1000)
  },
  {
    id: "mood-2",
    userId: "usr-demo-1",
    userName: "Juan Carlos Gutiérrez",
    mood: "Ansioso/a",
    emoji: "😟",
    note: "Cierre de entregas universitarias",
    createdAt: new Date()
  }
];

export function saveMoodEntry(userId: string, userName: string, mood: string, emoji: string, note?: string): MoodEntry {
  const entry: MoodEntry = {
    id: "mood-" + Date.now(),
    userId,
    userName,
    mood,
    emoji,
    note,
    createdAt: new Date()
  };
  moodEntries.unshift(entry);
  broadcastRealtime("MOOD_CREATED", entry);
  return entry;
}

export function getUserMoodEntries(userId: string): MoodEntry[] {
  return moodEntries.filter(m => m.userId === userId);
}

export function getAllMoodEntries(): MoodEntry[] {
  return moodEntries;
}

// =============================================================================
// TEST PSICOLÓGICO CLÍNICO RÁPIDO (GAD-2 / PHQ-2)
// =============================================================================
export interface MentalTestResult {
  id: string;
  userId: string;
  userName: string;
  testName: string;
  score: number;
  maxScore: number;
  severity: "Mínimo / Normal" | "Leve" | "Moderado" | "Significativo";
  recommendation: string;
  createdAt: Date;
}

const mentalTestResults: MentalTestResult[] = [];

export function saveTestResult(
  userId: string,
  userName: string,
  testName: string,
  score: number,
  maxScore: number,
  severity: MentalTestResult["severity"],
  recommendation: string
): MentalTestResult {
  const result: MentalTestResult = {
    id: "test-" + Date.now(),
    userId,
    userName,
    testName,
    score,
    maxScore,
    severity,
    recommendation,
    createdAt: new Date()
  };
  mentalTestResults.unshift(result);
  broadcastRealtime("TEST_CREATED", result);
  return result;
}

export function getUserTestResults(userId: string): MentalTestResult[] {
  return mentalTestResults.filter(t => t.userId === userId);
}

export function getAllTestResults(): MentalTestResult[] {
  return mentalTestResults;
}

// Estado conversacional para test psicológico
export interface ActiveTestState {
  testType?: "GAD2" | "PHQ9" | "PSS4";
  currentQuestion: number; // 0, 1, etc.
  answers: number[];
}

const userActiveTests = new Map<string, ActiveTestState>();

export function getActiveTest(userId: string): ActiveTestState | null {
  return userActiveTests.get(userId) ?? null;
}

export function setActiveTest(userId: string, state: ActiveTestState): void {
  userActiveTests.set(userId, state);
}

export function clearActiveTest(userId: string): void {
  userActiveTests.delete(userId);
}

// Preguntas del test GAD-2 (Escala validada internacionalmente para tamizaje de ansiedad)
export const GAD2_QUESTIONS = [
  "En las últimas 2 semanas, ¿con qué frecuencia te has sentido nervioso/a, ansioso/a o con los nervios de punta?",
  "En las últimas 2 semanas, ¿con qué frecuencia no has podido parar o controlar tus preocupaciones?"
];

// Preguntas del test PHQ-9 (Cuestionario de Salud del Paciente - Tamizaje de Depresión)
export const PHQ9_QUESTIONS = [
  "1. Poco interés o placer en hacer las cosas habituales.",
  "2. Sentirse decaído/a, deprimido/a o sin esperanzas.",
  "3. Dificultad para conciliar o mantener el sueño, o dormir demasiado.",
  "4. Sentirse cansado/a o con poca o ninguna energía.",
  "5. Poco apetito o por el contrario, comer en exceso.",
  "6. Sentirse mal consigo mismo/a, sentir que es un fracaso o haber decepcionado a otros.",
  "7. Dificultad para concentrarse en actividades habituales (lectura, trabajo, estudio).",
  "8. Lentitud psicomotriz evidente al hablar/moverse, o lo contrario (agitación e inquietud).",
  "9. Pensamientos de que sería mejor estar muerto/a o deseos de hacerse daño."
];

// Preguntas del test PSS-4 (Escala de Estrés Percibido de Cohen - 4 ítems)
export const PSS4_QUESTIONS = [
  "1. En el último mes, ¿con qué frecuencia has sentido que no podías controlar las cosas importantes en tu vida?",
  "2. En el último mes, ¿con qué frecuencia has tenido confianza en tu capacidad para manejar tus problemas personales?",
  "3. En el último mes, ¿con qué frecuencia has sentido que las cosas iban por buen camino?",
  "4. En el último mes, ¿con qué frecuencia has sentido que las dificultades se acumulaban tanto que no podías superarlas?"
];

// Consejos psicológicos y de mindfulness
export const PSYCHO_TIPS = [
  {
    title: "La regla de los 5 sentidos (Grounding)",
    content: "Cuando sientas sobrecarga o pánico: mira 5 cosas a tu alrededor, toca 4 texturas, identifica 3 sonidos, huele 2 aromas y saborea 1 cosa. Esto reconecta tu cerebro con el presente.",
    icon: "🧠"
  },
  {
    title: "Respiración 4-7-8 para el sueño",
    content: "Inhala silenciosamente por la nariz en 4 segundos, retén el aire durante 7 segundos y exhala fuertemente por la boca en 8 segundos. Reduce el ritmo cardíaco en minutos.",
    icon: "🌙"
  },
  {
    title: "Autocompasión ante el error",
    content: "¿Le hablarías a tu mejor amigo con la misma dureza con la que te hablas a ti mismo cuando cometes un error? Trátate con la misma amabilidad y comprensión.",
    icon: "💙"
  },
  {
    title: "Diferenciar control vs. no control",
    content: "Dibuja un círculo. Dentro coloca lo que depende de ti (tus acciones, tus palabras, tu esfuerzo). Fuera pon lo que no (el futuro, la opinión de otros, el clima). Enfoca tu energía solo en el interior.",
    icon: "🌿"
  },
  {
    title: "La pausa de 2 minutos",
    content: "Antes de reaccionar ante una situación que te enfurece o estresa, bebe un vaso de agua despacio. Ese lapso permite que tu corteza prefrontal tome el control sobre tu amígdala.",
    icon: "💧"
  }
];



export async function getAllUsers() {
  if (!prisma) return mockUsers;
  try {
    const users = await prisma.user.findMany({ orderBy: { fechaUltimaActividad: "desc" } });
    return users.length > 0 ? users : mockUsers;
  } catch (err) {
    return mockUsers;
  }
}

export async function getUserIntegrations(userId: string) {
  if (!prisma) return mockIntegrations.filter(i => i.userId === userId);
  try {
    return await prisma.integration.findMany({ where: { userId } });
  } catch (err) {
    return mockIntegrations.filter(i => i.userId === userId);
  }
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  email?: string;
  expiresAt?: number;
}
const userTokens = new Map<string, OAuthToken>();

export function storeGoogleToken(userId: string, accessToken: string, refreshToken?: string, email?: string) {
  userTokens.set(userId, { accessToken, refreshToken, email });
}

export function getGoogleToken(userId: string) {
  return userTokens.get(userId);
}

export async function setIntegrationStatus(userId: string, app: string, status: string, scopes: string[], extra?: { email?: string }) {
  if (!prisma) {
    const existing = mockIntegrations.find(i => i.userId === userId && i.provider === app);
    if (existing) {
      existing.status = status;
      existing.scopes = scopes.join(", ");
      existing.fechaAutorizacion = status === "conectado" ? new Date() : null;
      if (extra?.email) existing.email = extra.email;
    } else {
      mockIntegrations.push({
        id: "int-" + Date.now(),
        userId,
        provider: app,
        status,
        scopes: scopes.join(", "),
        fechaAutorizacion: status === "conectado" ? new Date() : null,
        email: extra?.email
      });
    }
    return;
  }

  try {
    await prisma.integration.upsert({
      where: { userId_provider: { userId, provider: app } },
      update: {
        status,
        scopes: scopes.join(", "),
        fechaAutorizacion: status === "conectado" ? new Date() : null
      },
      create: {
        userId,
        provider: app,
        status,
        scopes: scopes.join(", "),
        fechaAutorizacion: status === "conectado" ? new Date() : null
      }
    });
  } catch (err) {
    console.error("Error al actualizar integración:", err);
  }
}

export async function createVerification(username: string, nombreVisible: string) {
  const code = "v_" + Math.random().toString(36).substring(2, 10).toUpperCase();
  const session = {
    codigoVerificacion: code,
    username,
    nombreVisible,
    completado: false,
    expiracion: new Date(Date.now() + 30 * 60 * 1000)
  };
  mockSessions.set(code, session);

  if (prisma) {
    try {
      await prisma.sesionVerificacion.create({
        data: {
          codigoVerificacion: code,
          expiracion: session.expiracion
        }
      });
    } catch (_) {}
  }

  return session;
}

export async function confirmVerification(code: string, telegramId: string, username?: string, firstName?: string) {
  const session = mockSessions.get(code);

  if (prisma) {
    try {
      const dbUser = await prisma.user.upsert({
        where: { telegramId: String(telegramId) },
        update: {
          username: username ?? session?.username,
          firstName: firstName ?? session?.nombreVisible,
          estadoVerificacion: "verificado",
          fechaUltimaActividad: new Date()
        },
        create: {
          telegramId: String(telegramId),
          username: username ?? session?.username,
          firstName: firstName ?? session?.nombreVisible ?? "Usuario Telegram",
          estadoVerificacion: "verificado",
          rol: "usuario"
        }
      });

      await prisma.sesionVerificacion.updateMany({
        where: { codigoVerificacion: code },
        data: { completado: true, userId: dbUser.id, telegramIdProvisional: String(telegramId) }
      });

      return { success: true, user: dbUser };
    } catch (err) {
      console.error("Error al confirmar verificación:", err);
    }
  }

  const user = {
    id: "usr-" + telegramId,
    telegramId: String(telegramId),
    username: username ?? session?.username,
    firstName: firstName ?? session?.nombreVisible ?? "Usuario Verificado",
    rol: "usuario",
    estadoVerificacion: "verificado",
    fechaRegistro: new Date(),
    fechaUltimaActividad: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  mockUsers.push(user as any);
  if (session) session.completado = true;
  return { success: true, user };
}

export async function isUserVerified(telegramId: string | number): Promise<boolean> {
  // Acceso libre para demostración académica
  return true;
}

export async function getModuleData(modulo: string, fromDate?: string, toDate?: string) {
  const parseDate = (d?: string) => d ? new Date(d) : undefined;
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  const dateFilter = (dateField: string) => {
    const filter: any = {};
    if (from) filter.gte = from;
    if (to) filter.lte = to;
    return Object.keys(filter).length > 0 ? { [dateField]: filter } : {};
  };

  if (!prisma) {
    switch (modulo) {
      case "usuarios": return { total: mockUsers.length, items: mockUsers };
      case "integraciones": return { total: mockIntegrations.length, items: mockIntegrations };
      case "comandos": return { total: 3, items: [
        { comando: "/start", chatId: "123456789", resultado: "exito", createdAt: new Date() },
        { comando: "/menu", chatId: "123456789", resultado: "exito", createdAt: new Date() },
        { comando: "/github", chatId: "123456789", parametros: "facebook/react", resultado: "exito", createdAt: new Date() }
      ]};
      case "logs": return { total: 2, items: [
        { type: "START", modulo: "despliegue", detail: "Sistema iniciado correctamente", nivelSeveridad: "INFO", createdAt: new Date() },
        { type: "AUTH", modulo: "portal_web", detail: "Usuario autorizó Google Calendar", nivelSeveridad: "INFO", createdAt: new Date() }
      ]};
      case "juegos": return { total: 2, items: [
        { game: "trivia", userId: "usr-demo-1", points: 120, partidasJugadas: 15, aciertos: 12, updatedAt: new Date() },
        { game: "piedra_papel_tijera", userId: "usr-demo-1", points: 50, partidasJugadas: 10, aciertos: 7, updatedAt: new Date() }
      ]};
      default: return { total: 0, items: [] };
    }
  }

  try {
    switch (modulo) {
      case "usuarios": {
        const items = await prisma.user.findMany({
          where: dateFilter("createdAt"),
          orderBy: { createdAt: "desc" }
        });
        return { total: items.length, items };
      }
      case "comandos": {
        const items = await prisma.comando.findMany({
          where: dateFilter("createdAt"),
          orderBy: { createdAt: "desc" }
        });
        return { total: items.length, items };
      }
      case "integraciones": {
        const items = await prisma.integration.findMany({
          where: dateFilter("createdAt"),
          orderBy: { createdAt: "desc" }
        });
        return { total: items.length, items };
      }
      case "logs": {
        const items = await prisma.log.findMany({
          where: dateFilter("createdAt"),
          orderBy: { createdAt: "desc" }
        });
        return { total: items.length, items };
      }
      case "github": {
        const items = await prisma.githubCheck.findMany({
          where: dateFilter("createdAt"),
          orderBy: { createdAt: "desc" }
        });
        return { total: items.length, items };
      }
      case "youtube": {
        const items = await prisma.youtubeSearch.findMany({
          where: dateFilter("createdAt"),
          orderBy: { createdAt: "desc" }
        });
        return { total: items.length, items };
      }
      case "calendar": {
        const items = await prisma.calendarEvent.findMany({
          where: dateFilter("createdAt"),
          orderBy: { createdAt: "desc" }
        });
        return { total: items.length, items };
      }
      case "juegos": {
        const items = await prisma.gameScore.findMany({
          where: dateFilter("createdAt"),
          orderBy: { points: "desc" }
        });
        return { total: items.length, items };
      }
      default:
        return { total: 0, items: [] };
    }
  } catch (err) {
    console.error("Error al consultar módulo de reportes:", err);
    return { total: 0, items: [] };
  }
}

export async function saveComandoLog(chatId: string, comando: string, parametros?: string, resultado = "exito", error?: string, userId?: string) {
  if (!prisma) return;
  try {
    await prisma.comando.create({
      data: {
        chatId: String(chatId),
        comando,
        parametros,
        resultado,
        mensajeError: error,
        userId: userId ?? null
      }
    });
  } catch (_) {}
}

// =============================================================================
// OBSERVACIONES DEL PROFESOR: TRACKER DE GRUPOS, CHATS Y PARTICIPANTES
// =============================================================================
export type ChatInfo = {
  chatId: string;
  title: string;
  type: string;
  membersCount: number;
  admins: string[];
  lastActive: Date;
  messagesCount: number;
};

const chatsMap = new Map<string, ChatInfo>([
  ["chat-demo-1", {
    chatId: "-1002345678901",
    title: "Grupo Académico Base de Datos 🎓",
    type: "supergroup",
    membersCount: 24,
    admins: ["@juancarlos-33", "@profesor_bd"],
    lastActive: new Date(),
    messagesCount: 42
  }],
  ["chat-demo-2", {
    chatId: "987654321",
    title: "Chat Privado con María López",
    type: "private",
    membersCount: 2,
    admins: ["@maria_code"],
    lastActive: new Date(),
    messagesCount: 15
  }]
]);

export async function updateChatInfo(chatId: string, title: string, type: string, membersCount = 1, userOrAdmin?: string) {
  const existing = chatsMap.get(chatId);
  if (existing) {
    existing.title = title || existing.title;
    existing.type = type || existing.type;
    if (membersCount > 0) existing.membersCount = membersCount;
    existing.lastActive = new Date();
    existing.messagesCount += 1;
    if (userOrAdmin && !existing.admins.includes("@" + userOrAdmin.replace("@", ""))) {
      existing.admins.push("@" + userOrAdmin.replace("@", ""));
    }
  } else {
    chatsMap.set(chatId, {
      chatId,
      title: title || (type === "private" ? "Chat Privado" : "Grupo Telegram"),
      type,
      membersCount: membersCount || (type === "private" ? 2 : 1),
      admins: userOrAdmin ? ["@" + userOrAdmin.replace("@", "")] : ["@admin"],
      lastActive: new Date(),
      messagesCount: 1
    });
  }

  if (prisma && (type === "group" || type === "supergroup")) {
    try {
      await prisma.group.upsert({
        where: { telegramId: String(chatId) },
        update: { title },
        create: { telegramId: String(chatId), title }
      });
    } catch (_) {}
  }
}

export function getAllChats(): ChatInfo[] {
  return Array.from(chatsMap.values()).sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
}

// =============================================================================
// OBSERVACIONES DEL PROFESOR: COMANDOS PERSONALIZADOS DESDE LA WEB
// =============================================================================
export type CustomCommand = {
  command: string;
  response: string;
  usageCount: number;
  lastUsed?: Date;
  createdBy: string;
  createdAt: Date;
};

const customCommandsMap = new Map<string, CustomCommand>([
  ["/reglas", { 
    command: "/reglas", 
    response: "📜 Reglas del Grupo:\n1. Respeto mutuo entre estudiantes.\n2. No spam.\n3. Consultar dudas de bases de datos con responsabilidad.", 
    usageCount: 8, 
    lastUsed: new Date(), 
    createdBy: "Juan Carlos (Admin)", 
    createdAt: new Date() 
  }],
  ["/clase", { 
    command: "/clase", 
    response: "🎓 Proyecto Bot de Telegram v2.0\nProfesor: Evaluación de Base de Datos Relacional (PostgreSQL / MySQL)\nEstudiante: Juan Carlos.", 
    usageCount: 14, 
    lastUsed: new Date(), 
    createdBy: "Juan Carlos (Admin)", 
    createdAt: new Date() 
  }]
]);

export function getCustomCommands(): CustomCommand[] {
  return Array.from(customCommandsMap.values()).sort((a, b) => b.usageCount - a.usageCount);
}

export function addCustomCommand(command: string, response: string, createdBy = "Juan Carlos"): boolean {
  const cleanCmd = command.startsWith("/") ? command.trim().toLowerCase() : "/" + command.trim().toLowerCase();
  customCommandsMap.set(cleanCmd, {
    command: cleanCmd,
    response,
    usageCount: 0,
    createdBy,
    createdAt: new Date()
  });
  return true;
}

export function getCustomResponse(cmd: string): string | null {
  const found = customCommandsMap.get(cmd.trim().toLowerCase());
  if (found) {
    found.usageCount += 1;
    found.lastUsed = new Date();
    return found.response;
  }
  return null;
}

// Estadísticas de frecuencia de uso de comandos
const commandStatsMap = new Map<string, { command: string; count: number; lastUsed: Date; users: Set<string> }>();

export function recordCommandStat(command: string, username = "anónimo") {
  const cmd = command.toLowerCase();
  const current = commandStatsMap.get(cmd) ?? { command: cmd, count: 0, lastUsed: new Date(), users: new Set<string>() };
  current.count += 1;
  current.lastUsed = new Date();
  if (username) current.users.add(username);
  commandStatsMap.set(cmd, current);
}

export function getCommandStats() {
  return Array.from(commandStatsMap.values()).map(s => ({
    command: s.command,
    count: s.count,
    lastUsed: s.lastUsed,
    usersCount: s.users.size
  })).sort((a, b) => b.count - a.count);
}

