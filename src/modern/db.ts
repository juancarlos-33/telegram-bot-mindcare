import { PrismaClient } from "@prisma/client";

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
  return prisma.user.upsert({
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
}

export async function addXp(user: TelegramUser | undefined, amount: number) {
  const dbUser = await ensureUser(user);
  if (!dbUser || !prisma) return null;
  
  const newXp = dbUser.xp + amount;
  const newLevel = Math.floor(0.1 * Math.sqrt(newXp)) + 1; // Basic leveling formula
  
  const leveledUp = newLevel > dbUser.level;

  const updatedUser = await prisma.user.update({
    where: { id: dbUser.id },
    data: { 
      xp: newXp,
      level: newLevel,
      money: leveledUp ? dbUser.money + 500 : dbUser.money // Bonus money on level up
    }
  });

  return { user: updatedUser, leveledUp };
}

export async function ensureGroup(chat?: TelegramChat) {
  if (!chat || !prisma || (chat.type !== "group" && chat.type !== "supergroup")) return null;
  return prisma.group.upsert({
    where: { telegramId: String(chat.id) },
    update: {
      title: chat.title
    },
    create: {
      telegramId: String(chat.id),
      title: chat.title
    }
  });
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
  await prisma.githubCheck.create({ data: { chatId: String(chatId), repo, result } });
}

export async function saveYoutubeSearch(chatId: number | string, query: string, result: string) {
  if (!prisma) return;
  await prisma.youtubeSearch.create({ data: { chatId: String(chatId), query, result } });
}

export async function saveLog(chatId: number | string, type: string, detail: string) {
  if (!prisma) return;
  await prisma.log.create({ data: { chatId: String(chatId), type, detail } });
}

export async function disconnectDb() {
  await prisma?.$disconnect();
}

// Fallback en memoria si la BD está temporalmente desconectada
const mockUsers: any[] = [
  { id: "usr-demo-1", telegramId: "123456789", username: "juan_dev", firstName: "Juan Pérez", rol: "administrador", estadoVerificacion: "verificado", fechaRegistro: new Date(), fechaUltimaActividad: new Date(), createdAt: new Date(), updatedAt: new Date() },
  { id: "usr-demo-2", telegramId: "987654321", username: "maria_code", firstName: "María López", rol: "usuario", estadoVerificacion: "verificado", fechaRegistro: new Date(), fechaUltimaActividad: new Date(), createdAt: new Date(), updatedAt: new Date() }
];

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
  therapist: string;
  specialty: string;
  dateTime: string;
  status: "Confirmada" | "Pendiente" | "Completada" | "Cancelada";
  motive?: string;
  notes?: string;
  createdAt: Date;
}

const psyAppointments: PsyAppointment[] = [
  {
    id: "psi-101",
    patientId: "usr-demo-1",
    patientName: "Juan Carlos Gutiérrez",
    therapist: "Dra. Valentina Ríos",
    specialty: "Psicología Clínica Adultos",
    dateTime: "Mañana a las 10:00 AM",
    status: "Confirmada",
    motive: "Ansiedad generalizada y estrés laboral",
    notes: "Primera consulta de valoración",
    createdAt: new Date()
  },
  {
    id: "psi-102",
    patientId: "usr-demo-2",
    patientName: "María López",
    therapist: "Dr. Sebastián Torres",
    specialty: "Terapia de Pareja",
    dateTime: "Viernes 15:00 PM",
    status: "Pendiente",
    motive: "Comunicación y conflictos de pareja",
    notes: "Sesión inicial de evaluación",
    createdAt: new Date()
  }
];

export const PSYCHOLOGY_SPECIALTIES = [
  { id: "clinica", name: "Psicología Clínica Adultos", therapist: "Dra. Valentina Ríos", office: "Consultorio 201", waitTime: "10-15 min", icon: "🧠", description: "Ansiedad, depresión, estrés, fobias, TOC" },
  { id: "infantil", name: "Psicología Infantil y Adolescente", therapist: "Dra. Sofía Mendoza", office: "Consultorio 202", waitTime: "15 min", icon: "👦", description: "Dificultades conductuales, TDA/H, bullying, aprendizaje" },
  { id: "pareja", name: "Terapia de Pareja y Familia", therapist: "Dr. Sebastián Torres", office: "Consultorio 203", waitTime: "15-20 min", icon: "💑", description: "Comunicación, conflictos, divorcio, duelo familiar" },
  { id: "neuro", name: "Neuropsicología", therapist: "Dr. Andrés Castillo", office: "Consultorio 204", waitTime: "20-30 min", icon: "🔬", description: "Evaluación cognitiva, daño cerebral, Alzheimer, TDAH adulto" },
  { id: "duelo", name: "Psicología del Duelo y Crisis", therapist: "Dra. Luciana Vega", office: "Consultorio 205", waitTime: "10 min", icon: "🌿", description: "Pérdidas, traumas, crisis vitales, acompañamiento" },
  { id: "deporte", name: "Psicología del Deporte", therapist: "Dr. Felipe Ramos", office: "Consultorio 206", waitTime: "15 min", icon: "🏅", description: "Rendimiento, motivación, ansiedad competitiva" }
];

export function createPsyAppointment(appointment: Omit<PsyAppointment, "id" | "createdAt">): PsyAppointment {
  const newApp: PsyAppointment = {
    ...appointment,
    id: "psi-" + Math.floor(1000 + Math.random() * 9000),
    createdAt: new Date()
  };
  psyAppointments.unshift(newApp);
  return newApp;
}

export function getAllPsyAppointments(): PsyAppointment[] {
  return psyAppointments;
}

export function getPatientPsyAppointments(patientId: string): PsyAppointment[] {
  const lower = patientId.toLowerCase();
  return psyAppointments.filter(a =>
    a.patientId === patientId ||
    a.patientName.toLowerCase().includes(lower) ||
    patientId.includes(a.patientId)
  );
}

export function updatePsyAppointmentStatus(id: string, status: "Confirmada" | "Pendiente" | "Completada" | "Cancelada"): boolean {
  const app = psyAppointments.find(a => a.id === id);
  if (app) { app.status = status; return true; }
  return false;
}

export function cancelPsyAppointment(id: string): boolean {
  return updatePsyAppointmentStatus(id, "Cancelada");
}

export function hasPsyAppointmentConflict(therapist: string, dateTime: string, excludeId?: string): boolean {
  const normTime = dateTime.trim().toLowerCase();
  return psyAppointments.some(a => 
    a.therapist.toLowerCase() === therapist.toLowerCase() &&
    a.dateTime.trim().toLowerCase() === normTime &&
    a.status !== "Cancelada" &&
    a.id !== excludeId
  );
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

const mockPatients: ClinicalPatient[] = [
  {
    id: "HC-1001",
    fullName: "Juan Carlos Gutiérrez",
    document: "1098765432",
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

export function getAllPatients(): ClinicalPatient[] {
  return mockPatients;
}

export function getPatientById(id: string): ClinicalPatient | undefined {
  return mockPatients.find(p => p.id === id || p.fullName.toLowerCase().includes(id.toLowerCase()));
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
  return newPatient;
}

export function updatePatientStage(patientId: string, stage: PipelineStage): boolean {
  const patient = mockPatients.find(p => p.id === patientId);
  if (patient) {
    patient.pipelineStage = stage;
    patient.updatedAt = new Date();
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


// =============================================================================
// ESTADO CONVERSACIONAL DEL BOT (Flujo de agendamiento paso a paso)
// =============================================================================
export type BookingStep = "idle" | "ask_name" | "ask_specialty" | "ask_date" | "ask_motive" | "confirm";
export interface BookingState {
  step: BookingStep;
  name?: string;
  specialty?: string;
  therapist?: string;
  date?: string;
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

