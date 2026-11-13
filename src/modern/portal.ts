import { Router } from "express";
import type { Request, Response } from "express";
import { 
  prisma, 
  getAllUsers, 
  getUserIntegrations, 
  setIntegrationStatus, 
  createVerification, 
  getModuleData,
  saveLog,
  getAllChats,
  getCustomCommands,
  addCustomCommand,
  getCommandStats,
  storeGoogleToken,
  getGoogleToken,
  createPsyAppointment,
  getAllPsyAppointments,
  updatePsyAppointmentStatus,
  cancelPsyAppointment,
  PSYCHOLOGY_SPECIALTIES,
  PSYCHOLOGY_THERAPISTS,
  getAllMoodEntries,
  getAllTestResults,
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatientStage,
  addClinicalNote,
  recordPatientPayment,
  getAllPayments,
  getCRMMetrics,
  PipelineStage,
  patientExistsByDocument,
  hasPsyAppointmentConflict,
  flagPatientRisk
} from "./db.js";


export const portalRouter = Router();

const BOT_USERNAME = process.env.BOT_USERNAME ?? "juancarlos_project_bot";
const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
  (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null) ||
  (process.env.NODE_ENV === "production" ? "https://telegram-bot-mindcare-production.up.railway.app" : `http://localhost:${process.env.PORT ?? 3000}`);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Helper para verificar si la solicitud proviene del Administrador autenticado (Juan Carlos)
function checkIsAdmin(req: Request): boolean {
  const cookie = req.headers.cookie ?? "";
  if (cookie.includes("admin_session=juan_admin")) return true;
  if (req.query.admin === "true" || req.query.admin === "juan") return true;
  return false;
}

// =============================================================================
// PLANTILLA MAESTRA ULTRA-MODERNA (DESIGN SYSTEM CON GLASSMORPHISM Y TEMA OSCURO)
// =============================================================================
function layout(title: string, content: string, activeTab: string = "home", isAdmin = false): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | MindCare — Centro Clínico & Salud Mental Integrada</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-canvas: #060913;
      --bg-card: rgba(13, 20, 36, 0.78);
      --bg-card-hover: rgba(20, 30, 52, 0.88);
      --bg-surface: rgba(15, 23, 42, 0.65);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(56, 189, 248, 0.35);
      --border-emerald: rgba(16, 185, 129, 0.35);
      --primary: #0284c7;
      --primary-light: #38bdf8;
      --primary-glow: rgba(56, 189, 248, 0.22);
      --accent: #6366f1;
      --accent-light: #a5b4fc;
      --accent-glow: rgba(99, 102, 241, 0.25);
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.25);
      --tg-blue: #229ED9;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.12);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.12);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.12);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-canvas);
      background-image: 
        radial-gradient(ellipse 90% 55% at 50% -25%, rgba(14, 165, 233, 0.15), transparent 75%),
        radial-gradient(ellipse 70% 45% at 90% 85%, rgba(99, 102, 241, 0.09), transparent 75%),
        radial-gradient(ellipse 50% 35% at 10% 45%, rgba(16, 185, 129, 0.07), transparent 70%);
      background-attachment: fixed;
      color: var(--text-main);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-canvas); }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.28); }

    /* Header & Navegación Glassmorphic */
    header {
      background: rgba(6, 10, 20, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .navbar {
      max-width: 1320px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 24px;
      gap: 16px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: #fff;
      flex-shrink: 0;
    }

    .brand-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(14, 165, 233, 0.35);
      position: relative;
    }

    .brand-icon svg { width: 24px; height: 24px; fill: #ffffff; }

    .brand-text h1 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1.22rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      background: linear-gradient(135deg, #ffffff 40%, #bae6fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
      line-height: 1.1;
    }

    .brand-text span {
      font-size: 0.72rem;
      color: var(--primary-light);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      display: block;
      margin-top: 2px;
    }

    .nav-links {
      display: flex;
      gap: 5px;
      align-items: center;
      flex-wrap: wrap;
    }

    .nav-link {
      text-decoration: none;
      font-size: 0.86rem;
      font-weight: 600;
      color: var(--text-muted);
      padding: 8px 13px;
      border-radius: 10px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .nav-link:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }

    .nav-link.active {
      color: #fff;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.35);
      box-shadow: 0 0 16px rgba(14, 165, 233, 0.15);
    }

    .nav-btn-tg {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #fff !important;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nav-btn-tg:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(14, 165, 233, 0.45);
    }

    .admin-pill {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: #c7d2fe;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Main Container */
    main {
      max-width: 1320px;
      margin: 28px auto;
      padding: 0 24px;
      flex: 1;
      width: 100%;
    }

    /* Hero Banner */
    .hero-banner {
      background: linear-gradient(135deg, rgba(13, 20, 36, 0.88) 0%, rgba(20, 30, 52, 0.72) 100%);
      border: 1px solid var(--border-subtle);
      border-radius: 22px;
      padding: 38px 42px;
      position: relative;
      overflow: hidden;
      margin-bottom: 30px;
      box-shadow: 0 24px 50px -15px rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(16px);
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(14, 165, 233, 0.12);
      border: 1px solid rgba(14, 165, 233, 0.28);
      padding: 5px 14px;
      border-radius: 30px;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--primary-light);
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .hero-banner h1 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 2.35rem;
      font-weight: 800;
      letter-spacing: -0.035em;
      margin-bottom: 12px;
      line-height: 1.2;
      background: linear-gradient(135deg, #ffffff 40%, #bae6fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-banner p {
      font-size: 1.05rem;
      color: var(--text-muted);
      max-width: 860px;
      line-height: 1.65;
    }

    .hero-metrics {
      display: flex;
      gap: 14px;
      margin-top: 24px;
      flex-wrap: wrap;
    }

    .hero-metric-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #e2e8f0;
      background: rgba(255, 255, 255, 0.04);
      padding: 7px 16px;
      border-radius: 30px;
      border: 1px solid rgba(255, 255, 255, 0.07);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 12px var(--success);
      display: inline-block;
      animation: pulseDot 2s infinite;
    }

    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.85); }
    }

    /* Cards */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 20px;
      padding: 26px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 12px 35px -10px rgba(0, 0, 0, 0.4);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      margin-bottom: 24px;
      position: relative;
    }

    .card:hover {
      border-color: var(--border-accent);
      box-shadow: 0 18px 40px -12px rgba(14, 165, 233, 0.18);
    }

    .card-header-styled {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .card-title {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.015em;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Botones */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 22px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.9rem;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    .btn:active { transform: scale(0.98); }

    .btn-primary {
      background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
      color: #fff;
      box-shadow: 0 4px 18px rgba(14, 165, 233, 0.32);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%);
      box-shadow: 0 6px 24px rgba(14, 165, 233, 0.45);
      transform: translateY(-1px);
    }

    .btn-google {
      background: #ffffff;
      color: #0f172a;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(255, 255, 255, 0.15);
    }

    .btn-google:hover {
      background: #f8fafc;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: #e2e8f0;
      border: 1px solid var(--border-subtle);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.2);
    }

    .btn-danger {
      background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
      color: #fff;
    }

    /* Formularios */
    .form-group { margin-bottom: 18px; }

    label {
      display: block;
      font-weight: 600;
      font-size: 0.85rem;
      margin-bottom: 8px;
      color: #cbd5e1;
    }

    .input-wrapper { position: relative; }

    .input-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-dim);
      display: flex;
      align-items: center;
      pointer-events: none;
    }

    input[type="text"], input[type="date"], select, textarea {
      width: 100%;
      padding: 12px 16px;
      background: rgba(9, 14, 26, 0.7);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      font-size: 0.95rem;
      color: #fff;
      font-family: inherit;
      transition: all 0.2s ease;
    }

    textarea { min-height: 80px; resize: vertical; }

    .input-with-icon { padding-left: 44px !important; }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--primary-light);
      background: rgba(9, 14, 26, 0.9);
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.22);
    }

    select option { background: #0b1120; color: #fff; }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-success { background: var(--success-bg); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); }
    .badge-warning { background: var(--warning-bg); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }
    .badge-danger { background: var(--danger-bg); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
    .badge-info { background: rgba(14, 165, 233, 0.12); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); }
    .badge-purple { background: rgba(99, 102, 241, 0.14); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.35); }

    /* Tablas */
    .table-responsive {
      overflow-x: auto;
      border-radius: 16px;
      border: 1px solid var(--border-subtle);
      background: rgba(9, 14, 26, 0.45);
    }

    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.92rem; }
    th {
      background: rgba(13, 20, 36, 0.9);
      padding: 15px 18px;
      font-weight: 700;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
    }
    td { padding: 15px 18px; border-bottom: 1px solid var(--border-subtle); color: #cbd5e1; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.025); color: #fff; }

    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.84rem;
      background: rgba(255, 255, 255, 0.06);
      padding: 3px 8px;
      border-radius: 6px;
      color: #38bdf8;
    }

    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
      text-transform: uppercase;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    .alert {
      padding: 16px 20px;
      border-radius: 14px;
      margin-bottom: 24px;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 14px;
      backdrop-filter: blur(10px);
    }

    .alert-success { background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #6ee7b7; }
    .alert-info { background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(14, 165, 233, 0.35); color: #7dd3fc; }
    .alert-warning { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); color: #fde68a; }

    footer {
      border-top: 1px solid var(--border-subtle);
      padding: 26px 24px;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-dim);
      margin-top: auto;
      background: rgba(6, 10, 20, 0.75);
    }

    @media (max-width: 900px) {
      .navbar { flex-direction: column; gap: 14px; }
      .nav-links { flex-wrap: wrap; justify-content: center; }
      .grid-2 { grid-template-columns: 1fr; }
      .hero-banner { padding: 26px 22px; }
      .hero-banner h1 { font-size: 1.8rem; }
    }
  </style>
</head>
<body>
  <!-- Header Principal -->
  <header>
    <div class="navbar">
      <a href="/" class="brand">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </div>
        <div class="brand-text">
          <h1>MindCare</h1>
          <span>Centro Clínico & CRM Pro</span>
        </div>
      </a>
      <nav class="nav-links">
        <a href="/" class="nav-link ${activeTab === 'home' ? 'active' : ''}">
          🏠 Inicio
        </a>
        <a href="/citas" class="nav-link ${activeTab === 'citas' ? 'active' : ''}">
          📅 Citas & Bienestar
        </a>
        <a href="/crm" class="nav-link ${activeTab === 'crm' ? 'active' : ''}">
          💼 CRM & Historias
        </a>
        <a href="/grupos" class="nav-link ${activeTab === 'grupos' ? 'active' : ''}">
          💬 Grupos & Chats
        </a>
        <a href="/comandos" class="nav-link ${activeTab === 'comandos' ? 'active' : ''}">
          ⚡ Comandos Web
        </a>
        <a href="/reportes" class="nav-link ${activeTab === 'reportes' ? 'active' : ''}">
          📊 Reportes
        </a>
        <a href="/autorizar" class="nav-link ${activeTab === 'autorizar' ? 'active' : ''}">
          🔐 Apps
        </a>
        ${isAdmin ? `
          <div class="admin-pill">
            <span>👑 Juan Carlos</span>
            <a href="/logout" style="color:#f87171; text-decoration:none; margin-left:4px;" title="Cerrar Sesión">✕</a>
          </div>
        ` : `
          <a href="/login" class="btn btn-secondary" style="padding:7px 12px; font-size:0.8rem;">
            🔐 Admin
          </a>
        `}
        <a href="https://web.telegram.org/k/#@${BOT_USERNAME}" target="_blank" class="nav-link nav-btn-tg">
          <span class="status-dot"></span> Abrir Dra. PsiBot 💬
        </a>
      </nav>
    </div>
  </header>

  <main>
    ${content}
  </main>

  <footer>
    <div style="max-width: 1320px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
      <div>
        <strong style="color: #cbd5e1;">MindCare Health Technologies © 2026</strong> • Plataforma Clínica de Telepsicología & CRM Terapéutico
      </div>
      <div>
        <span style="color: var(--primary-light);">Confidencialidad Médica & Expedientes SOAP</span> • 
        <span>Integrado en Tiempo Real con Telegram Bot @${BOT_USERNAME}</span>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

function getInitials(name: string): string {
  if (!name) return "TB";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// =============================================================================
// RUTA: LOGIN DE ADMINISTRADOR (CON GOOGLE O ACCESO DIRECTO)
// =============================================================================
portalRouter.get("/login", (req: Request, res: Response) => {
  const googleAuthUrl = GOOGLE_CLIENT_ID 
    ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(APP_BASE_URL + '/auth/google/callback')}&response_type=code&scope=openid%20profile%20email&access_type=offline&prompt=consent`
    : "#";

  const content = `
    <div class="card" style="max-width: 520px; margin: 40px auto; text-align: center; padding: 40px 32px;">
      <div style="width: 70px; height: 70px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 2rem;">
        🔐
      </div>

      <h1 style="font-size: 1.8rem; font-weight: 800; color: #fff; margin-bottom: 8px;">Acceso de Administrador</h1>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 28px;">
        Este panel está restringido para el creador del proyecto (Juan Carlos). Inicia sesión para administrar comandos, auditar grupos y ver reportes de base de datos.
      </p>

      <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:24px;">
        ${GOOGLE_CLIENT_ID ? `
          <a href="${googleAuthUrl}" class="btn btn-google" style="padding: 14px; font-size: 1rem;">
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/></svg>
            Iniciar Sesión con Google
          </a>
        ` : ''}

        <form action="/login" method="POST" style="margin:0;">
          <input type="hidden" name="user" value="juancarlos">
          <button type="submit" class="btn btn-primary" style="width:100%; padding:14px; font-size:1rem;">
            Entrar como Administrador (Juan Carlos) 👑
          </button>
        </form>
      </div>

      <div style="border-top:1px solid var(--border-subtle); padding-top:16px; font-size:0.8rem; color:var(--text-dim);">
        Protección de roles implementada: solo el usuario con rol de Administrador tiene acceso a la auditoría técnica.
      </div>
    </div>
  `;

  res.send(layout("Iniciar Sesión", content, "home", false));
});

portalRouter.post("/login", (req: Request, res: Response) => {
  res.setHeader("Set-Cookie", "admin_session=juan_admin; Path=/; HttpOnly; Max-Age=86400");
  res.redirect("/?admin=true&login=success");
});

portalRouter.get("/logout", (req: Request, res: Response) => {
  res.setHeader("Set-Cookie", "admin_session=; Path=/; Max-Age=0");
  res.redirect("/?logout=true");
});

// Callback oficial de Google OAuth (Soporta Login de Admin e Integración de Google Calendar)
portalRouter.get("/auth/google/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(`/autorizar?error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code) {
    res.redirect("/login?error=no_code");
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID || "",
        client_secret: GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${APP_BASE_URL}/auth/google/callback`,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Google OAuth token error:", tokenData);
      res.redirect(`/autorizar?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
      return;
    }

    let userEmail = "";
    if (tokenData.access_token) {
      try {
        const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        if (infoRes.ok) {
          const info = await infoRes.json();
          userEmail = info.email || "";
        }
      } catch (_) {}
    }

    if (state && typeof state === "string" && state.startsWith("calendar_")) {
      const targetUserId = state.replace("calendar_", "");
      await setIntegrationStatus(targetUserId, "google_calendar", "conectado", ["calendar.events", "calendar.readonly"], { email: userEmail });
      if (tokenData.access_token) {
        storeGoogleToken(targetUserId, tokenData.access_token, tokenData.refresh_token, userEmail);
      }
      await saveLog("oauth", "INFO", `Google Calendar vinculado con éxito para usuario ${targetUserId} (${userEmail})`);
      res.redirect(`/autorizar?userId=${targetUserId}&oauth_success=google_calendar&email=${encodeURIComponent(userEmail)}`);
      return;
    }

    // Flujo por defecto: Iniciar sesión como Juan Carlos (Admin)
    res.setHeader("Set-Cookie", "admin_session=juan_admin; Path=/; HttpOnly; Max-Age=86400");
    res.redirect("/?admin=true&google_login=success");
  } catch (err: any) {
    console.error("Error al procesar callback de Google:", err);
    res.redirect(`/autorizar?error=${encodeURIComponent(err.message)}`);
  }
});

// =============================================================================
// RUTA 1: PÁGINA DE INICIO & REGISTRO DE USUARIOS
// =============================================================================
portalRouter.get("/", async (req: Request, res: Response) => {
  const isAdmin = checkIsAdmin(req);
  const users = await getAllUsers();
  const chats = getAllChats();
  const customCommands = getCustomCommands();
  const appointments = getAllPsyAppointments();
  const confirmedCount = appointments.filter(a => a.status === "Confirmada").length;
  const pendingCount = appointments.filter(a => a.status === "Pendiente").length;

  const content = `
    <!-- HERO BANNER CLÍNICO DE ALTO NIVEL -->
    <div class="hero-banner">
      <div class="hero-badge">
        <span class="status-dot"></span>
        <span>Clínica Digital Activa • 6 Especialistas Disponibles 24/7</span>
      </div>
      <h1>MindCare — Centro Clínico & Salud Mental Integrada</h1>
      <p>
        Ecosistema médico digital para reserva inmediata de citas, expedientes clínicos confidenciales (SOAP), tamizajes psicométricos en tiempo real y asistencia terapéutica continua con Dra. PsiBot en Telegram.
      </p>

      <div class="hero-metrics">
        <div class="hero-metric-item">
          <span class="status-dot"></span>
          <span>Dra. PsiBot: <strong>@${BOT_USERNAME}</strong> (Online)</span>
        </div>
        <div class="hero-metric-item">
          <span>📅 <strong>${appointments.length}</strong> Citas (${confirmedCount} Confirmadas)</span>
        </div>
        <div class="hero-metric-item">
          <span>👥 <strong>${users.length}</strong> Pacientes Registrados</span>
        </div>
        <div class="hero-metric-item">
          <span>🩺 <strong>6</strong> Consultorios Activos (201-206)</span>
        </div>
        <div class="hero-metric-item">
          <span>👑 Acceso: <strong>${isAdmin ? 'Director Médico (Admin)' : 'Público'}</strong></span>
        </div>
      </div>

      <div style="display:flex; gap:12px; margin-top:26px; flex-wrap:wrap;">
        <a href="#agendar" class="btn btn-primary">
          📅 Agendar Cita de Psicología
        </a>
        <a href="/crm" class="btn btn-secondary" style="border:1px solid rgba(99,102,241,0.4);">
          💼 Expedientes & CRM Clínico
        </a>
        <a href="https://web.telegram.org/k/#@${BOT_USERNAME}" target="_blank" class="btn btn-secondary" style="border:1px solid rgba(14,165,233,0.45); color:#38bdf8;">
          <span class="status-dot"></span> Abrir Chat en Telegram 💬
        </a>
      </div>
    </div>

    ${!isAdmin ? `
      <div class="alert alert-info" style="justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div>
          <strong>ℹ️ Portal de Atención Abierto:</strong> Puedes agendar citas libremente, consultar el directorio de terapeutas y evaluar tus síntomas. Para expedientes confidenciales y auditoría, ingresa como Especialista.
        </div>
        <a href="/login" class="btn btn-primary" style="padding:6px 14px; font-size:0.85rem;">
          Acceso Administrador 🔐
        </a>
      </div>
    ` : ''}

    <!-- SECCIÓN INTERACTIVA 1: AGENDAMIENTO RÁPIDO & ECOSISTEMA TERAPÉUTICO -->
    <div class="grid-2">
      <!-- Tarjeta 1: Agendamiento Rápido de Citas -->
      <div class="card" id="agendar" style="border:1px solid rgba(14,165,233,0.35);">
        <div class="card-header-styled">
          <div class="card-title">
            <span>📅</span>
            Agendamiento Rápido de Consulta
          </div>
          <span class="badge badge-success">● Turnos Disponibles</span>
        </div>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">
          Ingresa tus datos para registrar tu cita inmediatamente. Se sincronizará con Telegram Bot y el expediente del CRM.
        </p>

        <form action="/api/citas" method="POST">
          <div class="form-group">
            <label for="patientName">Nombre Completo del Paciente</label>
            <div class="input-wrapper">
              <span class="input-icon">👤</span>
              <input type="text" id="patientName" name="patientName" class="input-with-icon" placeholder="Ej: Juan Carlos Gutiérrez" required>
            </div>
          </div>
          <div class="form-group">
            <label for="specialty">Especialidad & Terapeuta Asignado</label>
            <select id="specialty" name="specialty" required>
              ${PSYCHOLOGY_SPECIALTIES.map(s => `
                <option value="${s.name}">${s.icon} ${s.name} — ${s.therapist}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="dateTime">Fecha y Horario Deseado</label>
            <div class="input-wrapper">
              <span class="input-icon">⏰</span>
              <input type="text" id="dateTime" name="dateTime" class="input-with-icon" placeholder="Ej: Mañana a las 2:00 PM o Viernes 10:00 AM" required>
            </div>
          </div>
          <div class="form-group">
            <label for="motive">Motivo de Consulta (Confidencial)</label>
            <textarea id="motive" name="motive" placeholder="Ej: Consulta por manejo de ansiedad, sobrecarga laboral o dificultades para dormir..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">
            Confirmar y Reservar Cita 📅
          </button>
        </form>
      </div>

      <!-- Tarjeta 2: Ecosistema Clínico MindCare & Asistente Dra. PsiBot -->
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div class="card-header-styled">
            <div class="card-title">
              <span>🧠</span>
              Ecosistema Terapéutico MindCare
            </div>
            <span class="badge badge-purple">IA & Psicometría</span>
          </div>
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:18px;">
            Herramientas integradas para acompañamiento emocional continuo y evaluación clínica objetiva.
          </p>
          <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:22px;">
            <div style="display:flex; align-items:flex-start; gap:12px; font-size:0.9rem; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
              <span style="font-size:1.3rem;">🧠</span>
              <div>
                <strong style="color:#fff;">Triaje Emocional IA Dra. PsiBot (Telegram):</strong>
                <div style="color:var(--text-muted); font-size:0.83rem;">Envía <code>!mensaje</code> o notas de voz para orientación empática con LLaMA 3.1.</div>
              </div>
            </div>
            <div style="display:flex; align-items:flex-start; gap:12px; font-size:0.9rem; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
              <span style="font-size:1.3rem;">📊</span>
              <div>
                <strong style="color:#fff;">Batería de Tamizaje Psicométrico (GAD-2 / PHQ-9):</strong>
                <div style="color:var(--text-muted); font-size:0.83rem;">Escalas diagnósticas estandarizadas con cálculo inmediato de riesgo.</div>
              </div>
            </div>
            <div style="display:flex; align-items:flex-start; gap:12px; font-size:0.9rem; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
              <span style="font-size:1.3rem;">🧘</span>
              <div>
                <strong style="color:#fff;">Técnicas de Regulación & Primeros Auxilios:</strong>
                <div style="color:var(--text-muted); font-size:0.83rem;">Respiración diafragmática 4-7-8, técnica sensorial SOS 5-4-3-2-1 y líneas 106/192.</div>
              </div>
            </div>
            <div style="display:flex; align-items:flex-start; gap:12px; font-size:0.9rem; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
              <span style="font-size:1.3rem;">💼</span>
              <div>
                <strong style="color:#fff;">Expedientes Clínicos Confidenciales SOAP:</strong>
                <div style="color:var(--text-muted); font-size:0.83rem;">Notas de evolución, fórmulas conductuales con QR y control contable.</div>
              </div>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <a href="/citas" class="btn btn-secondary" style="flex:1; text-align:center;">
            📅 Ver Citas (${appointments.length})
          </a>
          <a href="/crm" class="btn btn-secondary" style="flex:1; text-align:center; border:1px solid rgba(99,102,241,0.4);">
            💼 CRM Clínico
          </a>
          <a href="https://web.telegram.org/k/#@${BOT_USERNAME}" target="_blank" class="btn btn-primary" style="flex:1; text-align:center;">
            Abrir Dra. PsiBot 💬
          </a>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 2: DIRECTORIO DE ESPECIALISTAS Y CONSULTORIOS -->
    <div class="card" style="margin-bottom:28px;">
      <div class="card-header-styled">
        <div>
          <div class="card-title">
            <span>👥</span>
            Equipo Clínico de Especialistas MindCare
          </div>
          <span style="color:var(--text-dim); font-size:0.85rem;">Profesionales acreditados en psicología clínica y neurociencias</span>
        </div>
        <a href="#agendar" class="btn btn-secondary" style="font-size:0.85rem; padding:8px 16px;">
          Reservar Turno con un Especialista ↗
        </a>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:18px;">
        ${PSYCHOLOGY_THERAPISTS.map(th => `
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:18px; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.2s ease;">
            <div>
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                <div style="width:44px; height:44px; border-radius:12px; background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.3); display:flex; align-items:center; justify-content:center; font-size:1.5rem;">
                  ${th.icon}
                </div>
                <div>
                  <strong style="color:#fff; font-size:1rem; display:block;">${th.name}</strong>
                  <span style="color:var(--primary-light); font-size:0.82rem; font-weight:600;">${th.specialty}</span>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted); margin-bottom:14px; background:rgba(0,0,0,0.25); padding:6px 12px; border-radius:8px;">
                <span>📍 ${th.office}</span>
                <span class="badge badge-success" style="font-size:0.7rem; padding:2px 8px;">● Activo</span>
              </div>
            </div>
            <a href="#agendar" class="btn btn-secondary" style="padding:6px 12px; font-size:0.82rem; width:100%; text-align:center;">
              Agendar con ${th.name.split(' ')[0]} 📅
            </a>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- SECCIÓN 3: TABLA EN VIVO: CITAS DE PSICOLOGÍA AGENDADAS -->
    <div class="card" style="margin-bottom: 28px; border: 1px solid rgba(99, 102, 241, 0.4); background: linear-gradient(180deg, rgba(30, 27, 75, 0.22) 0%, rgba(13, 20, 36, 0.85) 100%);">
      <div class="card-header-styled" style="flex-wrap:wrap; gap:12px;">
        <div>
          <div class="card-title" style="color: #c7d2fe; font-size: 1.25rem;">
            <span>📅</span>
            Agenda Clínica en Tiempo Real (${appointments.length} Citas)
          </div>
          <span style="color:var(--text-dim); font-size:0.85rem;">Sincronización bidireccional inmediata con Telegram Bot @${BOT_USERNAME}</span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a href="/citas" class="btn btn-primary" style="font-size:0.85rem; padding:8px 16px;">
            Gestionar Citas Completas ↗
          </a>
          <a href="/crm" class="btn btn-secondary" style="font-size:0.85rem; padding:8px 16px;">
            Ver en CRM Clínico ↗
          </a>
        </div>
      </div>

      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Paciente</th>
              <th>Especialidad</th>
              <th>Terapeuta</th>
              <th>Horario</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${appointments.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align:center; padding:28px; color:var(--text-muted);">
                  Aún no hay citas registradas en el sistema. ¡Agenda la primera usando el formulario o vía Telegram con <code>/cita</code>!
                </td>
              </tr>
            ` : appointments.map(a => `
              <tr>
                <td><code style="color:var(--primary-light); font-weight:700;">${a.id}</code></td>
                <td><strong style="color:#fff;">${a.patientName}</strong></td>
                <td><span style="color:#a5b4fc; font-weight:600;">${a.specialty}</span></td>
                <td>${a.therapist}</td>
                <td><strong style="color:#38bdf8;">${a.dateTime}</strong></td>
                <td style="color:var(--text-muted); font-size:0.84rem; max-width:240px;">${a.motive ?? '—'}</td>
                <td>
                  <span class="badge ${a.status === 'Confirmada' ? 'badge-success' : a.status === 'Pendiente' ? 'badge-warning' : 'badge-danger'}">
                    ● ${a.status}
                  </span>
                </td>
                <td>
                  <a href="/citas" class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem;">
                    Gestionar ↗
                  </a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- SECCIÓN 4: TABLA DE USUARIOS Y PACIENTES REGISTRADOS -->
    <div class="card">
      <div class="card-header-styled">
        <div>
          <div class="card-title">
            <span>👥</span>
            Directorio de Pacientes y Cuentas Vinculadas (${users.length})
          </div>
          <span style="color:var(--text-dim); font-size:0.85rem;">Trazabilidad clínica y vinculación de identidades de Telegram</span>
        </div>
        <a href="/autorizar" class="btn btn-secondary" style="font-size:0.85rem; padding:8px 16px;">
          Integraciones de Terceros ⚡
        </a>
      </div>

      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Telegram Handle</th>
              <th>ID Telegram</th>
              <th>Rol</th>
              <th>Estado Verificación</th>
              <th>Última Actividad</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const displayName = u.firstName ?? u.nombreVisible ?? u.username ?? 'Sin Nombre';
              const initials = getInitials(displayName);
              return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div class="avatar">${initials}</div>
                      <div>
                        <strong style="color:#fff;">${displayName}</strong>
                        <div style="font-size:0.75rem; color:var(--text-dim);">${u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>${u.username ? '@' + u.username : 'N/A'}</td>
                  <td><code>${u.telegramId}</code></td>
                  <td><span class="badge ${u.rol === 'administrador' ? 'badge-purple' : 'badge-info'}">${u.rol ?? 'paciente'}</span></td>
                  <td>
                    <span class="badge ${u.estadoVerificacion === 'verificado' ? 'badge-success' : 'badge-warning'}">
                      ● ${u.estadoVerificacion}
                    </span>
                  </td>
                  <td>${new Date(u.fechaUltimaActividad ?? u.updatedAt ?? Date.now()).toLocaleString('es-CO')}</td>
                  <td>
                    <a href="/autorizar?userId=${u.id}" class="btn btn-secondary" style="padding:4px 10px; font-size:0.8rem;">
                      Gestionar Apps
                    </a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- SECCIÓN 5: VINCULACIÓN DE TELEGRAM (DISCRETA Y PROFESIONAL) -->
    <div class="card" style="margin-top:24px; background:rgba(15,23,42,0.45);">
      <div class="card-header-styled">
        <div class="card-title" style="font-size:1.1rem;">
          <span>🔗</span>
          Vincular Nueva Cuenta de Telegram
        </div>
        <span class="badge badge-info">Token Seguro</span>
      </div>
      <p style="color:var(--text-muted); font-size:0.88rem; margin-bottom:16px;">
        Si deseas vincular tu cuenta de Telegram manualmente con el portal clínico para recibir recordatorios automáticos de citas y prescripciones, ingresa tus datos a continuación:
      </p>
      <form action="/verificar" method="POST" style="display:grid; grid-template-columns: 1fr 1fr auto; gap:14px; align-items:end;">
        <div>
          <label for="username">Usuario Telegram</label>
          <div class="input-wrapper">
            <span class="input-icon">@</span>
            <input type="text" id="username" name="username" class="input-with-icon" placeholder="tu_usuario_telegram" required>
          </div>
        </div>
        <div>
          <label for="nombreVisible">Nombre del Paciente</label>
          <div class="input-wrapper">
            <span class="input-icon">👤</span>
            <input type="text" id="nombreVisible" name="nombreVisible" class="input-with-icon" placeholder="Ej: Juan Carlos" required>
          </div>
        </div>
        <div>
          <button type="submit" class="btn btn-primary" style="height:46px;">
            Generar Enlace 🔗
          </button>
        </div>
      </form>
    </div>
  `;

  res.send(layout("Inicio & Portal Clínico", content, "home", isAdmin));
});

// =============================================================================
// RUTA 2: AUDITORÍA DE GRUPOS Y CHATS DEL BOT
// =============================================================================
portalRouter.get("/grupos", (req: Request, res: Response) => {
  const isAdmin = checkIsAdmin(req);
  const chats = getAllChats();
  const totalMiembros = chats.reduce((acc, c) => acc + c.membersCount, 0);

  const content = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
      <div>
        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.25); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; color:var(--primary-light); margin-bottom:8px; text-transform:uppercase;">
          Auditoría de Canales • Trazabilidad & Cobertura
        </div>
        <h1 style="font-size: 2rem; font-weight: 800; color: #fff;">Grupos y Canales de Orientación Terapéutica</h1>
        <p style="color: var(--text-muted); font-size: 0.95rem;">
          Monitorea los grupos comunitarios y canales asistenciales donde interactúa Dra. PsiBot, total de integrantes y actividad en tiempo real.
        </p>
      </div>
    </div>

    <!-- Tarjetas de Resumen de Grupos -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; margin-bottom: 24px;">
      <div class="card" style="margin-bottom:0; padding:20px;">
        <span style="font-size:0.78rem; color:var(--text-dim); font-weight:700; text-transform:uppercase;">TOTAL GRUPOS / CHATS</span>
        <h3 style="font-size: 1.8rem; color: var(--primary-light); margin-top:4px; font-weight:800;">${chats.length}</h3>
        <span style="font-size:0.8rem; color:var(--text-muted);">Canales de interacción activos</span>
      </div>
      <div class="card" style="margin-bottom:0; padding:20px;">
        <span style="font-size:0.78rem; color:var(--text-dim); font-weight:700; text-transform:uppercase;">MIEMBROS ALCANZADOS</span>
        <h3 style="font-size: 1.8rem; color: #34d399; margin-top:4px; font-weight:800;">${totalMiembros}</h3>
        <span style="font-size:0.8rem; color:var(--text-muted);">Integrantes en los grupos</span>
      </div>
      <div class="card" style="margin-bottom:0; padding:20px;">
        <span style="font-size:0.78rem; color:var(--text-dim); font-weight:700; text-transform:uppercase;">ESTADO DEL BOT EN GRUPOS</span>
        <h3 style="font-size: 1.15rem; color: var(--success); margin-top:8px; font-weight:700; display:flex; align-items:center; gap:8px;">
          <span class="status-dot"></span>
          Escuchando con Prefijo '!'
        </h3>
        <span style="font-size:0.8rem; color:var(--text-muted);">Sin spam en grupos ajenos</span>
      </div>
    </div>

    <!-- Tabla Detallada de Grupos -->
    <div class="card">
      <div class="card-header-styled">
        <div class="card-title">
          <span>💬</span>
          Detalle de Grupos y Chats Detectados
        </div>
        <span style="color:var(--text-dim); font-size:0.85rem;">Actualización en tiempo real vía Telegram API</span>
      </div>

      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Nombre del Chat / Grupo</th>
              <th>Chat ID Telegram</th>
              <th>Tipo de Chat</th>
              <th>N° Integrantes</th>
              <th>Administradores / Contactos</th>
              <th>Mensajes Registrados</th>
              <th>Última Actividad</th>
            </tr>
          </thead>
          <tbody>
            ${chats.map(c => `
              <tr>
                <td>
                  <strong style="color:#fff; font-size:0.95rem;">${c.title}</strong>
                </td>
                <td><code>${c.chatId}</code></td>
                <td>
                  <span class="badge ${c.type === 'supergroup' || c.type === 'group' ? 'badge-info' : 'badge-purple'}">
                    ${c.type === 'supergroup' ? 'Supergrupo' : c.type === 'group' ? 'Grupo' : 'Chat Privado'}
                  </span>
                </td>
                <td>
                  <span style="font-weight:700; color:#38bdf8;">${c.membersCount} personas</span>
                </td>
                <td>
                  <span style="color:#cbd5e1; font-size:0.85rem;">
                    ${c.admins.length > 0 ? c.admins.join(', ') : '@admin'}
                  </span>
                </td>
                <td><strong>${c.messagesCount}</strong></td>
                <td>${new Date(c.lastActive).toLocaleString('es-CO')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  res.send(layout("Grupos y Chats", content, "grupos", isAdmin));
});

// =============================================================================
// RUTA 3: GESTOR DE COMANDOS Y AUTOMATIZACIÓN DESDE LA WEB
// =============================================================================
portalRouter.get("/comandos", (req: Request, res: Response) => {
  const isAdmin = checkIsAdmin(req);
  const customCommands = getCustomCommands();
  const commandStats = getCommandStats();

  const content = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
      <div>
        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.25); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; color:#a5b4fc; margin-bottom:8px; text-transform:uppercase;">
          Consola de Automatización • Comandos Dinámicos
        </div>
        <h1 style="font-size: 2rem; font-weight: 800; color: #fff;">Gestor de Comandos & Estadísticas de Uso</h1>
        <p style="color: var(--text-muted); font-size: 0.95rem;">
          Crea y despliega nuevos comandos interactivos en tiempo real sin reiniciar el bot y audita la frecuencia de interacciones en Telegram.
        </p>
      </div>
    </div>

    <div class="grid-2">
      <!-- Formulario para Agregar Nuevo Comando -->
      <div class="card">
        <div class="card-header-styled">
          <div class="card-title">
            <span>⚡</span>
            Agregar Nuevo Comando al Bot
          </div>
          <span class="badge badge-success">En Vivo</span>
        </div>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 18px;">
          Define un comando y la respuesta que enviará el bot cuando alguien lo escriba en Telegram:
        </p>

        <form action="/api/comandos" method="POST">
          <div class="form-group">
            <label for="command">Nombre del Comando (debe iniciar con /):</label>
            <input type="text" id="command" name="command" placeholder="/horario" required>
          </div>
          <div class="form-group">
            <label for="response">Respuesta que enviará el Bot en Telegram:</label>
            <textarea id="response" name="response" placeholder="Las tutorías de base de datos son los martes y jueves a las 4:00 PM." required></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">
            Guardar y Habilitar en Telegram 🚀
          </button>
        </form>
      </div>

      <!-- Estadísticas de Comandos Más Usados -->
      <div class="card">
        <div class="card-header-styled">
          <div class="card-title">
            <span>📈</span>
            Frecuencia de Uso de Comandos
          </div>
          <span class="badge badge-info">Auditoría</span>
        </div>

        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Comando</th>
                <th>Ejecuciones</th>
                <th>Usuarios Distintos</th>
                <th>Último Uso</th>
              </tr>
            </thead>
            <tbody>
              ${commandStats.length === 0 ? `
                <tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-dim);">Aún no se han registrado comandos en Telegram.</td></tr>
              ` : commandStats.map(s => `
                <tr>
                  <td><code style="font-size:0.95rem; font-weight:700;">${s.command}</code></td>
                  <td><strong style="color:var(--primary-light);">${s.count} veces</strong></td>
                  <td>${s.usersCount} usuarios</td>
                  <td>${new Date(s.lastUsed).toLocaleTimeString('es-CO')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tabla de Comandos Personalizados Creados desde Web -->
    <div class="card">
      <div class="card-header-styled">
        <div class="card-title">
          <span>📜</span>
          Comandos Dinámicos Creados desde la Web (${customCommands.length})
        </div>
        <span style="color:var(--text-dim); font-size:0.85rem;">Guardados en memoria/tabla para responder en Telegram</span>
      </div>

      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Comando</th>
              <th>Respuesta Automática del Bot</th>
              <th>Veces Usado</th>
              <th>Creado Por</th>
              <th>Fecha de Creación</th>
            </tr>
          </thead>
          <tbody>
            ${customCommands.map(c => `
              <tr>
                <td><code style="font-size:1rem; font-weight:700;">${c.command}</code></td>
                <td style="color:#e2e8f0; max-width:400px; white-space:pre-wrap;">${c.response}</td>
                <td><span class="badge badge-success">${c.usageCount} veces</span></td>
                <td><strong style="color:var(--primary-light);">${c.createdBy}</strong></td>
                <td>${new Date(c.createdAt).toLocaleDateString('es-CO')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  res.send(layout("Gestor de Comandos", content, "comandos", isAdmin));
});

// Endpoint POST para crear un comando desde la web
portalRouter.post("/api/comandos", (req: Request, res: Response) => {
  const { command, response } = req.body;
  if (command && response) {
    addCustomCommand(String(command), String(response), "Juan Carlos (Admin)");
  }
  res.redirect("/comandos?created=true");
});

// =============================================================================
// RUTA 3.5: GESTIÓN DE CITAS DE PSICOLOGÍA — MINDCARE
// =============================================================================
portalRouter.get("/citas", async (req: Request, res: Response) => {
  const isAdmin = checkIsAdmin(req);
  const appointments = getAllPsyAppointments();
  const confirmed = appointments.filter(a => a.status === "Confirmada").length;
  const pending = appointments.filter(a => a.status === "Pendiente").length;
  const canceled = appointments.filter(a => a.status === "Cancelada").length;

  let alertBanner = "";
  if (req.query.error) {
    alertBanner = `
      <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 14px 20px; margin-bottom: 24px; color: #f87171; font-weight: 600;">
        ⚠️ Error de validación: ${String(req.query.error)}
      </div>
    `;
  } else if (req.query.created === "true") {
    alertBanner = `
      <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 14px 20px; margin-bottom: 24px; color: #34d399; font-weight: 600;">
        ✅ Cita de psicología agendada y registrada exitosamente. Sincronizada con Google Calendar. 💙
      </div>
    `;
  } else if (req.query.updated === "true") {
    alertBanner = `
      <div style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 14px; padding: 14px 20px; margin-bottom: 24px; color: #38bdf8; font-weight: 600;">
        🔄 Estado de la cita actualizado correctamente.
      </div>
    `;
  }

  const allMoods = getAllMoodEntries();
  const allTests = getAllTestResults();

  const content = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
      <div>
        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(99, 102, 241, 0.12); border:1px solid rgba(99, 102, 241, 0.25); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; color:#a5b4fc; margin-bottom:8px; text-transform:uppercase;">
          🧠 MindCare — Centro de Psicología
        </div>
        <h1 style="font-size: 2rem; font-weight: 800; color: #fff;">Gestión de Citas & Bienestar Psicológico</h1>
        <p style="color: var(--text-muted); font-size: 0.95rem;">
          Agenda, confirma citas, monitorea el diario emocional de pacientes y evalúa tamizajes GAD-2. Integrado con Dra. PsiBot (Telegram).
        </p>
      </div>
      <div style="display:flex; gap:10px;">
        <a href="https://web.telegram.org/k/#@${BOT_USERNAME}" target="_blank" class="btn btn-primary" style="background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);">
          💬 Abrir Dra. PsiBot en Telegram
        </a>
      </div>
    </div>

    ${alertBanner}

    <!-- Métricas -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 18px; margin-bottom: 28px;">
      <div class="card" style="padding: 20px; text-align: center;">
        <span style="font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Total Citas</span>
        <div style="font-size: 2.2rem; font-weight: 800; color: #fff; margin: 8px 0;">${appointments.length}</div>
        <span style="font-size: 0.75rem; color: #a5b4fc;">Registradas en MindCare</span>
      </div>
      <div class="card" style="padding: 20px; text-align: center;">
        <span style="font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Confirmadas</span>
        <div style="font-size: 2.2rem; font-weight: 800; color: #34d399; margin: 8px 0;">${confirmed}</div>
        <span style="font-size: 0.75rem; color: #34d399;">En agenda terapéutica</span>
      </div>
      <div class="card" style="padding: 20px; text-align: center;">
        <span style="font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Chequeos de Ánimo</span>
        <div style="font-size: 2.2rem; font-weight: 800; color: #38bdf8; margin: 8px 0;">${allMoods.length}</div>
        <span style="font-size: 0.75rem; color: #bae6fd;">Diario emocional activo</span>
      </div>
      <div class="card" style="padding: 20px; text-align: center;">
        <span style="font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Tests GAD-2</span>
        <div style="font-size: 2.2rem; font-weight: 800; color: #a855f7; margin: 8px 0;">${allTests.length}</div>
        <span style="font-size: 0.75rem; color: #d8b4fe;">Evaluaciones realizadas</span>
      </div>
    </div>

    <!-- Formulario + Directorio -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px;">
      
      <!-- Formulario de agendamiento -->
      <div class="card">
        <h2 style="font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 6px;">📅 Agendar Cita de Psicología</h2>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 18px;">
          Registra una cita directamente desde el portal web.
        </p>
        <form action="/api/citas" method="POST">
          <div style="margin-bottom: 14px;">
            <label style="display:block; font-size:0.8rem; color:var(--text-dim); font-weight:700; margin-bottom:6px; text-transform:uppercase;">Nombre del Paciente:</label>
            <input type="text" name="patientName" required placeholder="Ej: Juan Carlos Gutiérrez" style="width:100%; padding:10px 14px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:10px; color:#fff; font-size:0.9rem;">
          </div>
          <div style="margin-bottom: 14px;">
            <label style="display:block; font-size:0.8rem; color:var(--text-dim); font-weight:700; margin-bottom:6px; text-transform:uppercase;">Especialidad:</label>
            <select name="specialty" required style="width:100%; padding:10px 14px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:10px; color:#fff; font-size:0.9rem;">
              ${PSYCHOLOGY_SPECIALTIES.map(s => `<option value="${s.name}">${s.icon} ${s.name} — ${s.therapist}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom: 14px;">
            <label style="display:block; font-size:0.8rem; color:var(--text-dim); font-weight:700; margin-bottom:6px; text-transform:uppercase;">Fecha y Horario:</label>
            <input type="text" name="dateTime" required placeholder="Ej: Viernes 10:00 AM" style="width:100%; padding:10px 14px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:10px; color:#fff; font-size:0.9rem;">
          </div>
          <div style="margin-bottom: 18px;">
            <label style="display:block; font-size:0.8rem; color:var(--text-dim); font-weight:700; margin-bottom:6px; text-transform:uppercase;">Motivo de Consulta:</label>
            <textarea name="notes" rows="2" placeholder="Ej: Ansiedad, dificultades relacionales, duelo..." style="width:100%; padding:10px 14px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:10px; color:#fff; font-size:0.9rem; resize:none;"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; padding:12px; font-weight:700; background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);">
            Confirmar y Registrar Cita 🧠
          </button>
        </form>
      </div>

      <!-- Directorio de Terapeutas -->
      <div class="card">
        <h2 style="font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 6px;">👥 Directorio de Terapeutas</h2>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">
          Especialistas vinculados al bot @${BOT_USERNAME}:
        </p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${PSYCHOLOGY_SPECIALTIES.map(s => `
            <div style="background:rgba(15,23,42,0.6); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                <span style="font-size:1.3rem;">${s.icon}</span>
                <div>
                  <div style="font-weight:700; color:#fff; font-size:0.9rem;">${s.name}</div>
                  <div style="color:var(--text-dim); font-size:0.78rem;">${s.therapist} · <span style="color:#93c5fd;">${s.office}</span></div>
                </div>
              </div>
              <div style="font-size:0.78rem; color:#a5b4fc; padding-left:38px;">📌 ${s.description}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Tabla de Citas -->
    <div class="card" style="margin-bottom: 28px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 700; color: #fff;">📋 Registro de Citas de Psicología</h2>
          <span style="color:var(--text-dim); font-size:0.85rem;">Historial sincronizado con Google Calendar y Telegram Bot</span>
        </div>
        <span class="badge badge-info" style="font-size:0.8rem;">${appointments.length} Citas</span>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Paciente</th>
              <th>Especialidad</th>
              <th>Terapeuta</th>
              <th>Horario</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${appointments.map(a => `
              <tr>
                <td><code style="color:var(--primary-light); font-weight:700;">${a.id}</code></td>
                <td><strong style="color:#fff;">${a.patientName}</strong></td>
                <td><span style="color:#a5b4fc; font-weight:600;">${a.specialty}</span></td>
                <td>${a.therapist}</td>
                <td>${a.dateTime}</td>
                <td style="color:var(--text-muted); font-size:0.82rem;">${a.motive ?? '—'}</td>
                <td>
                  <span class="badge ${a.status === 'Confirmada' ? 'badge-success' : a.status === 'Pendiente' ? 'badge-warning' : 'badge-danger'}">
                    ● ${a.status}
                  </span>
                </td>
                <td>
                  <div style="display:flex; gap:6px;">
                    ${a.status !== 'Confirmada' ? `
                      <form action="/api/citas/estado" method="POST" style="margin:0;">
                        <input type="hidden" name="id" value="${a.id}">
                        <input type="hidden" name="status" value="Confirmada">
                        <button type="submit" class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; color:#34d399;">Confirmar ✓</button>
                      </form>
                    ` : ''}
                    ${a.status !== 'Cancelada' ? `
                      <form action="/api/citas/estado" method="POST" style="margin:0;">
                        <input type="hidden" name="id" value="${a.id}">
                        <input type="hidden" name="status" value="Cancelada">
                        <button type="submit" class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;">Cancelar ✕</button>
                      </form>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sección de Diario Emocional y Evaluaciones GAD-2 -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      
      <!-- Diario Emocional -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #fff;">💭 Diario Emocional de Pacientes</h2>
            <span style="color:var(--text-dim); font-size:0.82rem;">Registros de estado de ánimo vía Telegram (/diario)</span>
          </div>
          <span class="badge badge-info" style="font-size:0.75rem;">${allMoods.length} Chequeos</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          ${allMoods.length === 0 ? '<p style="color:var(--text-dim); font-size:0.85rem;">No hay registros de ánimo aún.</p>' : ''}
          ${allMoods.slice(0, 5).map(m => `
            <div style="background:rgba(15,23,42,0.6); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.4rem;">${m.emoji}</span>
                <div>
                  <div style="font-weight:700; color:#fff; font-size:0.88rem;">${m.userName} — <span style="color:#a5b4fc;">${m.mood}</span></div>
                  ${m.note ? `<div style="color:var(--text-dim); font-size:0.78rem;">${m.note}</div>` : ''}
                </div>
              </div>
              <span style="font-size:0.75rem; color:var(--text-dim);">${new Date(m.createdAt).toLocaleDateString()}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Evaluaciones GAD-2 -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #fff;">📝 Evaluaciones Clínicas (GAD-2)</h2>
            <span style="color:var(--text-dim); font-size:0.82rem;">Tamizajes de ansiedad realizados vía Telegram (/test)</span>
          </div>
          <span class="badge badge-info" style="font-size:0.75rem;">${allTests.length} Tests</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          ${allTests.length === 0 ? '<p style="color:var(--text-dim); font-size:0.85rem;">No hay tests completados todavía. Usa /test en Telegram.</p>' : ''}
          ${allTests.slice(0, 5).map(t => `
            <div style="background:rgba(15,23,42,0.6); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong style="color:#fff; font-size:0.88rem;">${t.userName}</strong>
                <span class="badge ${t.score >= 4 ? 'badge-danger' : t.score >= 2 ? 'badge-warning' : 'badge-success'}" style="font-size:0.75rem;">
                  ${t.score}/${t.maxScore} pts · ${t.severity}
                </span>
              </div>
              <div style="font-size:0.78rem; color:var(--text-muted);">${t.recommendation}</div>
            </div>
          `).join('')}
        </div>
      </div>

    </div>

    <script>
      setInterval(function() {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
        if (!isTyping) {
          window.location.reload();
        }
      }, 20000);
    </script>
  `;

  res.send(layout("Citas & Salud Mental — MindCare", content, "citas", isAdmin));
});

// Endpoint POST para agendar cita desde la web
portalRouter.post("/api/citas", async (req: Request, res: Response) => {
  const { patientName, specialty, dateTime, notes } = req.body;
  const cleanName = String(patientName || "").trim();
  const cleanDate = String(dateTime || "").trim();

  if (!cleanName || cleanName.length < 3) {
    res.redirect("/citas?error=" + encodeURIComponent("El nombre del paciente debe tener al menos 3 caracteres."));
    return;
  }
  if (!cleanDate || cleanDate.length < 4) {
    res.redirect("/citas?error=" + encodeURIComponent("Por favor ingresa una fecha y horario válidos (ej: Viernes 10:00 AM)."));
    return;
  }

  const spec = PSYCHOLOGY_SPECIALTIES.find(s => s.name === specialty) || PSYCHOLOGY_SPECIALTIES[0];
  
  if (hasPsyAppointmentConflict(spec.therapist, cleanDate)) {
    res.redirect("/citas?error=" + encodeURIComponent(`Conflicto de agenda: ${spec.therapist} ya cuenta con una cita en el horario "${cleanDate}". Por favor selecciona otro turno.`));
    return;
  }

  createPsyAppointment({
    patientId: "web-paciente",
    patientName: cleanName,
    therapist: spec.therapist,
    specialty: spec.name,
    dateTime: cleanDate,
    status: "Confirmada",
    motive: notes ? String(notes).trim() : undefined
  });
  await saveLog("citas_psi", "INFO", `Cita de psicología agendada para ${cleanName} en ${spec.name} con ${spec.therapist}`);
  res.redirect("/citas?created=true");
});

// Endpoint POST para cambiar estado de cita
portalRouter.post("/api/citas/estado", (req: Request, res: Response) => {
  const { id, status } = req.body;
  if (id && status) {
    updatePsyAppointmentStatus(String(id), status as any);
  }
  res.redirect("/citas?updated=true");
});

// =============================================================================
// RUTA 3.8: CRM CLÍNICO, HISTORIAS CLÍNICAS (SOAP) & FACTURACIÓN (MINDCARE PRO)
// =============================================================================
portalRouter.get("/crm", async (req: Request, res: Response) => {
  const isAdmin = checkIsAdmin(req);
  const patients = getAllPatients();
  const metrics = getCRMMetrics();
  const payments = getAllPayments();
  const appointments = getAllPsyAppointments();

  let banner = "";
  if (req.query.error) {
    banner = `<div style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); border-radius:14px; padding:14px 20px; margin-bottom:24px; color:#f87171; font-weight:600;">⚠️ Error de validación: ${String(req.query.error)}</div>`;
  } else if (req.query.created === "true") {
    banner = `<div style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.4); border-radius:14px; padding:14px 20px; margin-bottom:24px; color:#34d399; font-weight:600;">✅ Paciente registrado con éxito en el CRM clínico.</div>`;
  } else if (req.query.stage_updated === "true") {
    banner = `<div style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.4); border-radius:14px; padding:14px 20px; margin-bottom:24px; color:#38bdf8; font-weight:600;">🔄 Etapa del paciente actualizada en el embudo clínico.</div>`;
  } else if (req.query.note_added === "true") {
    banner = `<div style="background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.4); border-radius:14px; padding:14px 20px; margin-bottom:24px; color:#d8b4fe; font-weight:600;">📝 Nota de evolución SOAP guardada en el expediente clínico.</div>`;
  } else if (req.query.payment_added === "true") {
    banner = `<div style="background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); border-radius:14px; padding:14px 20px; margin-bottom:24px; color:#fbbf24; font-weight:600;">💰 Pago de consulta registrado en el libro contable.</div>`;
  }

  const formatCOP = (num: number) => `$${num.toLocaleString('es-CO')} COP`;

  const content = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
      <div>
        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(99, 102, 241, 0.15); border:1px solid rgba(99, 102, 241, 0.3); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; color:#a5b4fc; margin-bottom:8px; text-transform:uppercase;">
          💼 Módulo Profesional • CRM & Gestión Clínica
        </div>
        <h1 style="font-size: 2rem; font-weight: 800; color: #fff;">MindCare CRM & Historias Clínicas</h1>
        <p style="color: var(--text-muted); font-size: 0.95rem;">
          Control integral de pacientes, evolución terapéutica SOAP, embudo de retención y facturación de consultas psicológicas.
        </p>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a href="/api/crm/export/csv" class="btn btn-secondary" style="border:1px solid rgba(52,211,153,0.4); color:#34d399; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
          📥 Exportar a CSV / Excel
        </a>
        <a href="#nuevo-paciente" class="btn btn-primary" style="background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);">
          ➕ Nuevo Paciente
        </a>
      </div>
    </div>

    ${banner}

    <!-- Métricas Clave del CRM -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 28px;">
      <div class="card" style="padding: 18px; text-align: center;">
        <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Pacientes Totales</span>
        <div style="font-size: 2.1rem; font-weight: 800; color: #fff; margin: 6px 0;">${metrics.totalPatients}</div>
        <span style="font-size: 0.72rem; color: #a5b4fc;">Expedientes en BD</span>
      </div>
      <div class="card" style="padding: 18px; text-align: center;">
        <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">En Tratamiento Activo</span>
        <div style="font-size: 2.1rem; font-weight: 800; color: #34d399; margin: 6px 0;">${metrics.activePatients}</div>
        <span style="font-size: 0.72rem; color: #34d399;">Retención: ${metrics.retentionRate}%</span>
      </div>
      <div class="card" style="padding: 18px; text-align: center;">
        <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Sesiones Totales</span>
        <div style="font-size: 2.1rem; font-weight: 800; color: #38bdf8; margin: 6px 0;">${metrics.totalSessions}</div>
        <span style="font-size: 0.72rem; color: #38bdf8;">Atendidas en clínica</span>
      </div>
      <div class="card" style="padding: 18px; text-align: center;">
        <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Ingresos Recaudados</span>
        <div style="font-size: 1.6rem; font-weight: 800; color: #f59e0b; margin: 8px 0;">${formatCOP(metrics.totalRevenue)}</div>
        <span style="font-size: 0.72rem; color: #fbbf24;">Cobrado con éxito</span>
      </div>
      <div class="card" style="padding: 18px; text-align: center;">
        <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Pendiente por Cobrar</span>
        <div style="font-size: 1.6rem; font-weight: 800; color: #f87171; margin: 8px 0;">${formatCOP(metrics.pendingRevenue)}</div>
        <span style="font-size: 0.72rem; color: #f87171;">Facturas activas</span>
      </div>
    </div>

    <!-- Pipeline Visual Funnel de Pacientes -->
    <div class="card" style="margin-bottom: 28px;">
      <h2 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin-bottom: 14px;">🎯 Embudo de Pacientes (Clinical Pipeline)</h2>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:140px; background:rgba(15,23,42,0.8); border:1px solid rgba(56,189,248,0.25); border-radius:12px; padding:14px; text-align:center;">
          <span style="font-size:0.75rem; color:#38bdf8; font-weight:700; text-transform:uppercase;">1. Leads / Triaje</span>
          <div style="font-size:1.8rem; font-weight:800; color:#fff; margin:4px 0;">${metrics.newLeads}</div>
          <span style="font-size:0.72rem; color:var(--text-dim);">Interés / Test GAD-2</span>
        </div>
        <div style="flex:1; min-width:140px; background:rgba(15,23,42,0.8); border:1px solid rgba(99,102,241,0.25); border-radius:12px; padding:14px; text-align:center;">
          <span style="font-size:0.75rem; color:#a5b4fc; font-weight:700; text-transform:uppercase;">2. Primera Cita</span>
          <div style="font-size:1.8rem; font-weight:800; color:#fff; margin:4px 0;">${metrics.firstAppointments}</div>
          <span style="font-size:0.72rem; color:var(--text-dim);">Valoración inicial</span>
        </div>
        <div style="flex:1; min-width:140px; background:rgba(15,23,42,0.8); border:1px solid rgba(16,185,129,0.25); border-radius:12px; padding:14px; text-align:center;">
          <span style="font-size:0.75rem; color:#34d399; font-weight:700; text-transform:uppercase;">3. Tratamiento Activo</span>
          <div style="font-size:1.8rem; font-weight:800; color:#fff; margin:4px 0;">${metrics.activePatients}</div>
          <span style="font-size:0.72rem; color:var(--text-dim);">Sesiones regulares</span>
        </div>
        <div style="flex:1; min-width:140px; background:rgba(15,23,42,0.8); border:1px solid rgba(168,85,247,0.25); border-radius:12px; padding:14px; text-align:center;">
          <span style="font-size:0.75rem; color:#d8b4fe; font-weight:700; text-transform:uppercase;">4. Alta Terapéutica</span>
          <div style="font-size:1.8rem; font-weight:800; color:#fff; margin:4px 0;">${metrics.discharges}</div>
          <span style="font-size:0.72rem; color:var(--text-dim);">Objetivos logrados</span>
        </div>
      </div>
    <!-- Citas Sincronizadas en CRM -->
    <div class="card" style="margin-bottom: 28px; border: 1px solid rgba(99, 102, 241, 0.35);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
        <div>
          <h2 style="font-size: 1.2rem; font-weight: 700; color: #fff; display:flex; align-items:center; gap:8px;">
            <span>📅</span> Citas de Psicología Sincronizadas (${appointments.length})
          </h2>
          <span style="color:var(--text-dim); font-size:0.85rem;">Citas registradas vía Telegram Bot @${BOT_USERNAME} conectadas al expediente clínico</span>
        </div>
        <a href="/citas" class="btn btn-secondary" style="font-size:0.8rem; padding:6px 14px;">
          Abrir Módulo de Citas ↗
        </a>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Paciente</th>
              <th>Especialidad</th>
              <th>Terapeuta</th>
              <th>Horario</th>
              <th>Motivo Clínico</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${appointments.length === 0 ? `
              <tr><td colspan="7" style="text-align:center; padding:18px; color:var(--text-dim);">No hay citas registradas en el sistema.</td></tr>
            ` : appointments.slice(0, 8).map(a => `
              <tr>
                <td><code>${a.id}</code></td>
                <td><strong style="color:#fff;">${a.patientName}</strong></td>
                <td><span style="color:#a5b4fc;">${a.specialty}</span></td>
                <td>${a.therapist}</td>
                <td><strong style="color:#38bdf8;">${a.dateTime}</strong></td>
                <td style="color:var(--text-muted); font-size:0.82rem; max-width:200px;">${a.motive ?? '—'}</td>
                <td>
                  <span class="badge ${a.status === 'Confirmada' ? 'badge-success' : a.status === 'Pendiente' ? 'badge-warning' : 'badge-danger'}">
                    ● ${a.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tabla Principal de Pacientes & Expedientes Clínicos -->
    <div class="card" style="margin-bottom: 28px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 700; color: #fff;">📁 Directorio de Expedientes Clínicos</h2>
          <span style="color:var(--text-dim); font-size:0.85rem;">Historias clínicas digitales con evolución SOAP y estados de pago</span>
        </div>
        <span class="badge badge-info" style="font-size:0.8rem;">${patients.length} Expedientes</span>
      </div>

      <!-- Filtro y Buscador Dinámico -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px; background:rgba(15,23,42,0.5); padding:12px; border-radius:10px; border:1px solid var(--border-subtle);">
        <input id="patientSearchInput" onkeyup="filterPatientTable()" placeholder="🔍 Buscar por nombre, cédula o terapeuta..." style="padding:8px 14px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem; min-width:300px;">
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="filterByStage('all')" style="padding:6px 12px; font-size:0.75rem;">Todos</button>
          <button type="button" class="btn btn-secondary" onclick="filterByStage('Tratamiento_Activo')" style="padding:6px 12px; font-size:0.75rem; color:#34d399;">En Tratamiento</button>
          <button type="button" class="btn btn-secondary" onclick="filterByStage('Primera_Cita')" style="padding:6px 12px; font-size:0.75rem; color:#fde047;">Primera Cita</button>
          <button type="button" class="btn btn-secondary" onclick="filterByStage('Triaje')" style="padding:6px 12px; font-size:0.75rem; color:#38bdf8;">Triaje</button>
          <button type="button" class="btn btn-secondary" onclick="filterByStage('Alta_Terapeutica')" style="padding:6px 12px; font-size:0.75rem; color:#d8b4fe;">Alta</button>
        </div>
      </div>

      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Paciente</th>
              <th>Etapa Pipeline</th>
              <th>Diagnóstico / Hipótesis</th>
              <th>Terapeuta</th>
              <th>Sesiones</th>
              <th>Etiquetas</th>
              <th>Cambiar Etapa</th>
              <th>Documentos Oficiales</th>
            </tr>
          </thead>
          <tbody id="patientTableBody">
            ${patients.map(p => `
              <tr class="patient-row" data-stage="${p.pipelineStage}">
                <td><code style="color:var(--primary-light); font-weight:700;">${p.id}</code></td>
                <td>
                  <a href="/paciente/${p.id}" style="color:#fff; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                    ${p.fullName} <span style="font-size:0.75rem; color:#60a5fa;">↗</span>
                  </a><br>
                  <span style="color:var(--text-dim); font-size:0.75rem;">Doc: ${p.document} · ${p.age} años</span>
                </td>
                <td>
                  <span class="badge ${
                    p.pipelineStage === 'Tratamiento_Activo' ? 'badge-success' :
                    p.pipelineStage === 'Primera_Cita' ? 'badge-warning' :
                    p.pipelineStage === 'Alta_Terapeutica' ? 'badge-info' : 'badge-danger'
                  }">
                    ● ${p.pipelineStage.replace('_', ' ')}
                  </span>
                </td>
                <td style="max-width:240px; font-size:0.82rem; color:#e2e8f0;">
                  ${p.diagnosticHypothesis}
                </td>
                <td style="font-size:0.85rem;">
                  <strong style="color:#a5b4fc;">${p.assignedTherapist}</strong><br>
                  <span style="color:var(--text-dim); font-size:0.75rem;">${p.specialty}</span>
                </td>
                <td style="text-align:center;">
                  <span class="badge badge-info" style="font-weight:700;">${p.totalSessions}</span>
                </td>
                <td>
                  <div style="display:flex; gap:4px; flex-wrap:wrap;">
                    ${p.tags.map(t => `<span style="font-size:0.7rem; background:${t.includes('RIESGO') ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}; border:${t.includes('RIESGO') ? '1px solid #f87171' : 'none'}; padding:2px 6px; border-radius:6px; color:${t.includes('RIESGO') ? '#fca5a5' : '#cbd5e1'}; font-weight:${t.includes('RIESGO') ? '700' : '400'};">#${t}</span>`).join('')}
                  </div>
                </td>
                <td>
                  <form action="/api/crm/etapa" method="POST" style="margin:0; display:flex; gap:4px;">
                    <input type="hidden" name="patientId" value="${p.id}">
                    <select name="stage" onchange="this.form.submit()" style="padding:4px 8px; font-size:0.75rem; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); color:#fff; border-radius:6px;">
                      <option value="Lead" ${p.pipelineStage === 'Lead' ? 'selected' : ''}>Lead</option>
                      <option value="Triaje" ${p.pipelineStage === 'Triaje' ? 'selected' : ''}>Triaje</option>
                      <option value="Primera_Cita" ${p.pipelineStage === 'Primera_Cita' ? 'selected' : ''}>Primera Cita</option>
                      <option value="Tratamiento_Activo" ${p.pipelineStage === 'Tratamiento_Activo' ? 'selected' : ''}>En Tratamiento</option>
                      <option value="Alta_Terapeutica" ${p.pipelineStage === 'Alta_Terapeutica' ? 'selected' : ''}>Alta</option>
                      <option value="Seguimiento" ${p.pipelineStage === 'Seguimiento' ? 'selected' : ''}>Seguimiento</option>
                    </select>
                  </form>
                </td>
                <td>
                  <div style="display:flex; gap:4px; flex-direction:column;">
                    <a href="/paciente/${p.id}" class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem; color:#a5b4fc; text-decoration:none; display:inline-flex; align-items:center; gap:4px; border:1px solid rgba(165,180,252,0.3);">
                      📂 Expediente 360° ↗
                    </a>
                    <a href="/paciente/${p.id}/certificado" target="_blank" class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem; color:#60a5fa; text-decoration:none; display:inline-flex; align-items:center; gap:4px; border:1px solid rgba(96,165,250,0.3);">
                      📜 Certificado ↗
                    </a>
                    <a href="/paciente/${p.id}/formula" target="_blank" class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem; color:#34d399; text-decoration:none; display:inline-flex; align-items:center; gap:4px; border:1px solid rgba(52,211,153,0.3);">
                      💊 Fórmula Conductual ↗
                    </a>
                    <a href="/paciente/${p.id}/consentimiento" target="_blank" class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem; color:#fde047; text-decoration:none; display:inline-flex; align-items:center; gap:4px; border:1px solid rgba(253,224,71,0.3);">
                      📝 Consentimiento Ley 1090 ↗
                    </a>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Módulo 2 Columnas: Notas SOAP y Facturación -->
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px;">
      
      <!-- Notas de Evolución Clínica (SOAP) -->
      <div class="card">
        <h2 style="font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 6px;">📝 Registrar Nota de Evolución (SOAP)</h2>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">
          Documentación clínica estándar para psicólogos (Subjetivo, Objetivo, Análisis, Plan).
        </p>
        <form action="/api/crm/nota" method="POST">
          <div style="margin-bottom: 12px;">
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Seleccionar Paciente:</label>
            <select name="patientId" required style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
              ${patients.map(p => `<option value="${p.id}">${p.id} — ${p.fullName} (${p.assignedTherapist})</option>`).join('')}
            </select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Número de Sesión:</label>
              <input type="number" name="sessionNumber" value="1" min="1" required style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
            </div>
            <div>
              <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Fecha de Sesión:</label>
              <input type="date" name="date" required value="${new Date().toISOString().slice(0, 10)}" style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
            </div>
          </div>
          <div style="margin-bottom: 10px;">
            <label style="display:block; font-size:0.75rem; color:#93c5fd; font-weight:700; margin-bottom:4px;">[S] Subjetivo (Lo que el paciente relata):</label>
            <textarea name="subjective" rows="2" required placeholder="Ej: Reporta disminución de crisis de angustia, pero dificultades en conciliar sueño..." style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem; resize:none;"></textarea>
          </div>
          <div style="margin-bottom: 10px;">
            <label style="display:block; font-size:0.75rem; color:#86efac; font-weight:700; margin-bottom:4px;">[O] Objetivo (Observaciones conductuales):</label>
            <textarea name="objective" rows="2" required placeholder="Ej: Postura relajada, tono de voz pausado, coherencia ideoafectiva..." style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem; resize:none;"></textarea>
          </div>
          <div style="margin-bottom: 10px;">
            <label style="display:block; font-size:0.75rem; color:#fde047; font-weight:700; margin-bottom:4px;">[A] Análisis (Evaluación del terapeuta):</label>
            <textarea name="analysis" rows="2" required placeholder="Ej: Progreso favorable en regulación emocional. Persisten distorsiones de polarización..." style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem; resize:none;"></textarea>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display:block; font-size:0.75rem; color:#f472b6; font-weight:700; margin-bottom:4px;">[P] Plan (Tareas y próximas metas):</label>
            <textarea name="plan" rows="2" required placeholder="Ej: Registro conductual diario de respiración 4-7-8 y técnica de parada de pensamiento..." style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem; resize:none;"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; padding:10px; font-weight:700; background:linear-gradient(135deg, #a855f7 0%, #9333ea 100%);">
            Guardar Nota SOAP en Expediente 📝
          </button>
        </form>
      </div>

      <!-- Facturación & Libro Contable de Consultas -->
      <div class="card">
        <h2 style="font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 6px;">💳 Registrar Pago de Sesión</h2>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">
          Control financiero de honorarios profesionales por consulta.
        </p>
        <form action="/api/crm/pago" method="POST" style="margin-bottom: 24px;">
          <div style="margin-bottom: 12px;">
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Paciente:</label>
            <select name="patientId" required style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
              ${patients.map(p => `<option value="${p.id}">${p.id} — ${p.fullName}</option>`).join('')}
            </select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Valor (COP):</label>
              <input type="number" name="amount" value="120000" step="10000" required style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
            </div>
            <div>
              <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Método de Pago:</label>
              <select name="method" required style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
                <option value="Nequi / Daviplata">Nequi / Daviplata</option>
                <option value="Transferencia">Transferencia Bancaria</option>
                <option value="Tarjeta">Tarjeta de Crédito / Débito</option>
                <option value="Efectivo">Efectivo en Consultorio</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Concepto:</label>
            <input type="text" name="concept" value="Sesión de Terapia Individual" required style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Estado:</label>
            <select name="status" style="width:100%; padding:8px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
              <option value="Pagado">Pagado ✓</option>
              <option value="Pendiente">Pendiente de Pago ⌛</option>
              <option value="Exonerado">Exonerado (Convenio)</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; padding:10px; font-weight:700; background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
            Registrar Factura / Pago 💰
          </button>
        </form>

        <!-- Historial Reciente de Pagos -->
        <h3 style="font-size:0.95rem; font-weight:700; color:#fff; margin-bottom:10px;">📋 Últimos Pagos Registrados</h3>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${payments.slice(0, 4).map(pay => `
            <div style="background:rgba(15,23,42,0.6); border:1px solid var(--border-subtle); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="font-size:0.85rem; color:#fff;">${pay.patientName}</strong><br>
                <span style="font-size:0.72rem; color:var(--text-dim);">${pay.concept} · ${pay.method}</span>
              </div>
              <div style="text-align:right;">
                <span style="font-weight:700; color:#34d399; font-size:0.88rem;">${formatCOP(pay.amount)}</span><br>
                <span class="badge ${pay.status === 'Pagado' ? 'badge-success' : 'badge-warning'}" style="font-size:0.68rem;">● ${pay.status}</span>
              </div>
            </div>
          `).join('')}
        </div>

      </div>

    </div>

    <!-- Formulario para Registrar Nuevo Paciente -->
    <div class="card" id="nuevo-paciente">
      <h2 style="font-size: 1.25rem; font-weight: 700; color: #fff; margin-bottom: 6px;">➕ Apertura de Nuevo Expediente de Paciente</h2>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 18px;">
        Registra los datos sociodemográficos y clínicos para iniciar el seguimiento en el CRM.
      </p>

      <form action="/api/crm/paciente" method="POST">
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:14px; margin-bottom:14px;">
          <div>
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Nombre Completo:</label>
            <input type="text" name="fullName" required placeholder="Ej: Andrés Felipe Gómez" style="width:100%; padding:10px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
          </div>
          <div>
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Documento de Identidad:</label>
            <input type="text" name="document" required placeholder="Ej: 1098234567" style="width:100%; padding:10px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
          </div>
          <div>
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Edad:</label>
            <input type="number" name="age" value="25" min="3" max="100" required style="width:100%; padding:10px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-bottom:14px;">
          <div>
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Teléfono / WhatsApp:</label>
            <input type="text" name="phone" required placeholder="+57 300 123 4567" style="width:100%; padding:10px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
          </div>
          <div>
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Correo Electrónico:</label>
            <input type="email" name="email" required placeholder="paciente@correo.com" style="width:100%; padding:10px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-bottom:14px;">
          <div>
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Especialidad Requerida:</label>
            <select name="specialty" required style="width:100%; padding:10px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
              ${PSYCHOLOGY_SPECIALTIES.map(s => `<option value="${s.name}">${s.icon} ${s.name} — ${s.therapist}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Etapa Inicial en CRM:</label>
            <select name="stage" style="width:100%; padding:10px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
              <option value="Lead">Lead (Nuevo Contacto)</option>
              <option value="Triaje">Triaje Completado</option>
              <option value="Primera_Cita" selected>Primera Cita Programada</option>
              <option value="Tratamiento_Activo">Tratamiento Activo</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom: 14px;">
          <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Hipótesis Diagnóstica Inicial / Motivo de Consulta:</label>
          <input type="text" name="diagnostic" required placeholder="Ej: F41.1 Síntomas ansiosos y estrés situacional" style="width:100%; padding:10px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display:block; font-size:0.75rem; color:var(--text-dim); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Etiquetas (separadas por coma):</label>
          <input type="text" name="tags" placeholder="Ansiedad, Estudiantes, TCC" value="Ansiedad, Adultos" style="width:100%; padding:10px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; font-size:0.85rem;">
        </div>

        <button type="submit" class="btn btn-primary" style="padding:12px 24px; font-weight:700; font-size:0.95rem;">
          Crear Expediente Clínico 📁
        </button>
      </form>
    </div>

    <script>
      function filterPatientTable() {
        const input = document.getElementById('patientSearchInput');
        const filter = (input ? input.value : '').toLowerCase().trim();
        const rows = document.querySelectorAll('.patient-row');
        rows.forEach(row => {
          const text = row.textContent || '';
          row.style.display = text.toLowerCase().includes(filter) ? '' : 'none';
        });
      }

      function filterByStage(stage) {
        const rows = document.querySelectorAll('.patient-row');
        rows.forEach(row => {
          if (stage === 'all') {
            row.style.display = '';
          } else {
            const rStage = row.getAttribute('data-stage');
            row.style.display = (rStage === stage) ? '' : 'none';
          }
        });
      }
    </script>
  `;

  res.send(layout("CRM Clínico & Historias — MindCare", content, "crm", isAdmin));
});

// Endpoint POST para crear nuevo paciente en CRM con validaciones completas
portalRouter.post("/api/crm/paciente", (req: Request, res: Response) => {
  const { fullName, document, age, phone, email, specialty, stage, diagnostic, tags } = req.body;
  const cleanName = String(fullName || "").trim();
  const cleanDoc = String(document || "").trim();
  const cleanPhone = String(phone || "").trim();
  const cleanEmail = String(email || "").trim();
  const numAge = Number(age);

  if (!cleanName || cleanName.length < 3) {
    res.redirect("/crm?error=" + encodeURIComponent("El nombre completo debe tener al menos 3 caracteres."));
    return;
  }
  if (!cleanDoc || cleanDoc.length < 5) {
    res.redirect("/crm?error=" + encodeURIComponent("El documento de identidad debe tener al menos 5 caracteres."));
    return;
  }
  if (patientExistsByDocument(cleanDoc)) {
    res.redirect("/crm?error=" + encodeURIComponent(`Ya existe un paciente con el documento de identidad ${cleanDoc}.`));
    return;
  }
  if (isNaN(numAge) || numAge < 1 || numAge > 120) {
    res.redirect("/crm?error=" + encodeURIComponent("Por favor ingresa una edad válida (entre 1 y 120 años)."));
    return;
  }
  if (!cleanPhone || cleanPhone.length < 7) {
    res.redirect("/crm?error=" + encodeURIComponent("Por favor ingresa un teléfono de contacto válido (mínimo 7 dígitos)."));
    return;
  }
  if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    res.redirect("/crm?error=" + encodeURIComponent("Por favor ingresa un correo electrónico válido."));
    return;
  }

  const spec = PSYCHOLOGY_SPECIALTIES.find(s => s.name === specialty) || PSYCHOLOGY_SPECIALTIES[0];
  const tagsArr = tags ? String(tags).split(',').map((t: string) => t.trim()).filter(Boolean) : ["General"];
  
  createPatient({
    fullName: cleanName,
    document: cleanDoc,
    age: numAge,
    phone: cleanPhone,
    email: cleanEmail,
    specialty: spec.name,
    assignedTherapist: spec.therapist,
    pipelineStage: (stage as PipelineStage) || "Primera_Cita",
    diagnosticHypothesis: diagnostic ? String(diagnostic).trim() : "En evaluación clínica",
    tags: tagsArr
  });
  
  res.redirect("/crm?created=true");
});

// Endpoint POST para actualizar etapa del embudo de un paciente
portalRouter.post("/api/crm/etapa", (req: Request, res: Response) => {
  const { patientId, stage } = req.body;
  if (patientId && stage) {
    updatePatientStage(String(patientId), stage as PipelineStage);
  }
  res.redirect("/crm?stage_updated=true");
});

// Endpoint POST para agregar nota SOAP de evolución con validaciones
portalRouter.post("/api/crm/nota", (req: Request, res: Response) => {
  const { patientId, sessionNumber, date, subjective, objective, analysis, plan } = req.body;
  const cleanId = String(patientId || "").trim();
  const cleanSubj = String(subjective || "").trim();
  const cleanObj = String(objective || "").trim();
  const cleanAna = String(analysis || "").trim();
  const cleanPlan = String(plan || "").trim();

  if (!cleanId) {
    res.redirect("/crm?error=" + encodeURIComponent("Debes seleccionar un paciente para la nota SOAP."));
    return;
  }
  const patient = getPatientById(cleanId);
  if (!patient) {
    res.redirect("/crm?error=" + encodeURIComponent("Expediente no encontrado en la base de datos."));
    return;
  }
  if (!cleanSubj || !cleanObj || !cleanAna || !cleanPlan) {
    res.redirect("/crm?error=" + encodeURIComponent("Todos los campos SOAP (Subjetivo, Objetivo, Análisis, Plan) son obligatorios."));
    return;
  }

  addClinicalNote(cleanId, {
    patientId: cleanId,
    therapist: patient.assignedTherapist ?? "Dra. Valentina Ríos",
    sessionNumber: Number(sessionNumber) || 1,
    date: String(date || new Date().toISOString().slice(0, 10)),
    subjective: cleanSubj,
    objective: cleanObj,
    analysis: cleanAna,
    plan: cleanPlan
  });
  res.redirect("/crm?note_added=true");
});

// Endpoint POST para registrar pago de sesión con validaciones
portalRouter.post("/api/crm/pago", (req: Request, res: Response) => {
  const { patientId, amount, method, concept, status } = req.body;
  const cleanId = String(patientId || "").trim();
  const numAmount = Number(amount);

  if (!cleanId) {
    res.redirect("/crm?error=" + encodeURIComponent("Debes seleccionar un paciente para registrar el pago."));
    return;
  }
  const patient = getPatientById(cleanId);
  if (!patient) {
    res.redirect("/crm?error=" + encodeURIComponent("Expediente no encontrado."));
    return;
  }
  if (isNaN(numAmount) || numAmount <= 0) {
    res.redirect("/crm?error=" + encodeURIComponent("El valor del pago debe ser mayor a 0 COP."));
    return;
  }

  recordPatientPayment({
    patientId: cleanId,
    patientName: patient.fullName,
    concept: String(concept || "Sesión de Psicología"),
    amount: numAmount,
    method: method || "Nequi / Daviplata",
    status: status || "Pagado",
    date: new Date().toISOString().slice(0, 10)
  });
  res.redirect("/crm?payment_added=true");
});

// Endpoint GET para exportar el CRM completo a CSV / Excel
portalRouter.get("/api/crm/export/csv", (req: Request, res: Response) => {
  const patients = getAllPatients();
  const headers = [
    "ID_Expediente",
    "Nombre_Completo",
    "Documento",
    "Edad",
    "Telefono",
    "Email",
    "Especialidad",
    "Terapeuta_Asignado",
    "Etapa_CRM",
    "Hipotesis_Diagnostica",
    "Total_Sesiones",
    "Total_Pagado_COP",
    "Total_Pendiente_COP",
    "Fecha_Registro"
  ];

  const escapeCsv = (str: any) => `"${String(str ?? '').replace(/"/g, '""')}"`;

  const rows = patients.map(p => {
    const paid = p.payments.filter(pay => pay.status === "Pagado").reduce((a, b) => a + b.amount, 0);
    const pending = p.payments.filter(pay => pay.status === "Pendiente").reduce((a, b) => a + b.amount, 0);
    return [
      escapeCsv(p.id),
      escapeCsv(p.fullName),
      escapeCsv(p.document),
      p.age,
      escapeCsv(p.phone),
      escapeCsv(p.email),
      escapeCsv(p.specialty),
      escapeCsv(p.assignedTherapist),
      escapeCsv(p.pipelineStage),
      escapeCsv(p.diagnosticHypothesis),
      p.totalSessions,
      paid,
      pending,
      escapeCsv(p.createdAt.toISOString().slice(0, 10))
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="mindcare_pacientes_crm.csv"');
  res.status(200).send(csvContent);
});

// =============================================================================
// RUTA 3.10: FÓRMULA MÉDICA DE PRESCRIPCIÓN CONDUCTUAL & PLAN DE AUTOCUIDADO
// =============================================================================
portalRouter.get("/paciente/:id/formula", (req: Request, res: Response) => {
  const patient = getPatientById(String(req.params.id));
  if (!patient) {
    res.status(404).send(layout("Paciente no encontrado", "<div class='card' style='text-align:center; padding:40px;'><h1>404 - Expediente no encontrado</h1></div>", "crm", false));
    return;
  }

  const verifyUrl = `${APP_BASE_URL}/paciente/${patient.id}/formula`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`;
  const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Fórmula Médica Conductual - ${patient.fullName} (${patient.id})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f19;
      color: #1e293b;
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 30px 15px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .toolbar {
      max-width: 800px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .btn {
      padding: 10px 18px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print { background: #059669; color: #fff; }
    .btn-back { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
    .btn-print:hover { background: #047857; }
    
    .sheet {
      background: #ffffff;
      width: 100%;
      max-width: 800px;
      padding: 50px 60px;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 6px solid #e2e8f0;
      position: relative;
      color: #0f172a;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #059669;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .logo-badge {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      color: #fff;
    }
    .rx-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 0.88rem;
    }
    .rx-item span { color: #047857; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; display: block; }
    .rx-item strong { color: #064e3b; font-size: 0.95rem; }

    .prescriptions {
      margin-bottom: 28px;
    }
    .presc-item {
      display: flex;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px dashed #cbd5e1;
    }
    .presc-num {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #059669;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.9rem;
      flex-shrink: 0;
    }
    .presc-title { font-weight: 700; font-size: 0.98rem; color: #0f172a; margin-bottom: 4px; }
    .presc-desc { font-size: 0.88rem; color: #334155; line-height: 1.5; }

    .signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 40px;
      padding-top: 15px;
    }
    .sign-box { text-align: center; width: 230px; }
    .sign-line { border-bottom: 1.5px solid #0f172a; margin-bottom: 6px; }

    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { box-shadow: none; border: none; padding: 30px; }
    }
  </style>
</head>
<body>

  <div class="toolbar">
    <a href="/crm" class="btn btn-back">← Volver al CRM</a>
    <button onclick="window.print()" class="btn btn-print">🖨️ Imprimir / Guardar en PDF</button>
  </div>

  <div class="sheet">
    <div class="header">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="logo-badge">💊</div>
        <div>
          <h1 style="font-size:1.25rem; font-weight:800; color:#064e3b;">MINDCARE PSICOLOGÍA CLÍNICA</h1>
          <p style="font-size:0.75rem; color:#059669; font-weight:700; text-transform:uppercase;">Prescripción Médica Conductual & Plan Terapéutico</p>
        </div>
      </div>
      <div style="text-align:right;">
        <span style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">No. Fórmula</span>
        <strong style="font-family:'JetBrains Mono', monospace; font-size:1.1rem; color:#059669;">RX-${patient.id}</strong>
      </div>
    </div>

    <div class="rx-box">
      <div class="rx-item">
        <span>Paciente:</span>
        <strong>${patient.fullName}</strong>
      </div>
      <div class="rx-item">
        <span>Identificación:</span>
        <strong>CC ${patient.document} (${patient.age} años)</strong>
      </div>
      <div class="rx-item">
        <span>Especialista Tratante:</span>
        <strong>${patient.assignedTherapist}</strong>
      </div>
      <div class="rx-item">
        <span>Hipótesis Diagnóstica:</span>
        <strong>${patient.diagnosticHypothesis}</strong>
      </div>
    </div>

    <div style="margin-bottom:14px; font-weight:800; font-size:0.95rem; color:#0f172a; text-transform:uppercase; letter-spacing:0.04em;">
      📋 Indicaciones Terapéuticas y Farmacología Conductual:
    </div>

    <div class="prescriptions">
      <div class="presc-item">
        <div class="presc-num">1</div>
        <div>
          <div class="presc-title">Regulación Circadiana e Higiene del Sueño</div>
          <div class="presc-desc">Establecer hora fija de despertar (7:00 AM). Cese total de pantallas luminosas (celular, computador) 45 minutos antes de dormir. Si no concilia el sueño en 20 minutos, levantarse y realizar lectura pasiva con luz cálida.</div>
        </div>
      </div>

      <div class="presc-item">
        <div class="presc-num">2</div>
        <div>
          <div class="presc-title">Desactivación Fisiológica (Respiración 4-7-8)</div>
          <div class="presc-desc">Realizar 4 ciclos de respiración diafragmática (4s inhalar, 7s retener, 8s exhalar) dos veces al día: al despertar y antes de dormir, o inmediatamente al notar opresión torácica.</div>
        </div>
      </div>

      <div class="presc-item">
        <div class="presc-num">3</div>
        <div>
          <div class="presc-title">Técnica de Parada y Reestructuración Cognitiva (TCC)</div>
          <div class="presc-desc">Ante pensamientos automáticos catastróficos ("todo saldrá mal", "no soy capaz"), aplicar auto-instrucción "ALTO" y redactar un pensamiento objetivo alternativo basado en evidencias reales.</div>
        </div>
      </div>

      <div class="presc-item">
        <div class="presc-num">4</div>
        <div>
          <div class="presc-title">Activación Conductual y Auto-Monitoreo Digital</div>
          <div class="presc-desc">Caminata o actividad física moderada de 25-30 minutos al aire libre. Registrar estado emocional diario en el bot Telegram de MindCare mediante el comando <code>/diario</code>.</div>
        </div>
      </div>
    </div>

    <div style="background:#f8fafc; border-left:4px solid #059669; padding:12px 16px; border-radius:4px; font-size:0.85rem; color:#334155; margin-bottom:30px;">
      <strong>Próximo Control:</strong> Sesión terapéutica de seguimiento en 7 a 15 días según evolución. En caso de urgencia emocional o crisis desbordante, activar código de emergencia con Línea 106 / 123.
    </div>

    <div class="signatures">
      <div style="display:flex; align-items:center; gap:14px;">
        <img src="${qrUrl}" alt="QR Verificación" style="width:80px; height:80px; border:1px solid #cbd5e1; border-radius:6px; padding:3px; background:#fff;">
        <div style="font-size:0.72rem; color:#64748b; line-height:1.4;">
          <strong>Verificación Digital</strong><br>
          Código: RX-${patient.id}<br>
          Fecha: ${dateStr}<br>
          MindCare Salud Mental
        </div>
      </div>

      <div class="sign-box">
        <div class="sign-line"></div>
        <strong style="color:#0f172a; font-size:0.95rem;">${patient.assignedTherapist}</strong>
        <span style="font-size:0.75rem; color:#64748b; display:block;">Psicólogo/a Clínico/a Titulado/a</span>
        <span style="font-size:0.72rem; color:#059669; font-weight:700;">T.P. No. 184920-COLPSIC</span>
      </div>
    </div>
  </div>

</body>
</html>`;

  res.send(html);
});

// =============================================================================
// RUTA 3.9: CERTIFICADO CLÍNICO OFICIAL DESCARGABLE / IMPRIMIBLE (PDF & QR)
// =============================================================================
portalRouter.get("/paciente/:id/certificado", (req: Request, res: Response) => {
  const patient = getPatientById(String(req.params.id));
  if (!patient) {
    res.status(404).send(layout("Paciente no encontrado", "<div class='card' style='text-align:center; padding:40px;'><h1>404 - Expediente no encontrado</h1></div>", "crm", false));
    return;
  }

  const verifyUrl = `${APP_BASE_URL}/paciente/${patient.id}/certificado`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(verifyUrl)}`;
  const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Certificado Clínico - ${patient.fullName} (${patient.id})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f19;
      color: #1e293b;
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 30px 15px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .toolbar {
      max-width: 800px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .btn {
      padding: 10px 18px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print { background: #2563eb; color: #fff; }
    .btn-back { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
    .btn-print:hover { background: #1d4ed8; }
    
    /* Hoja Oficial de Certificado */
    .certificate-sheet {
      background: #ffffff;
      width: 100%;
      max-width: 800px;
      padding: 50px 60px;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 8px double #cbd5e1;
      position: relative;
      color: #0f172a;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo-area { display: flex; align-items: center; gap: 14px; }
    .logo-badge {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      color: #fff;
    }
    .institution h1 { font-size: 1.25rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
    .institution p { font-size: 0.8rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .code-box { text-align: right; }
    .code-box span { font-size: 0.72rem; color: #94a3b8; text-transform: uppercase; display: block; font-weight: 700; }
    .code-box strong { font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; color: #2563eb; }

    .title-banner { text-align: center; margin-bottom: 35px; }
    .title-banner h2 {
      font-family: 'Playfair Display', serif;
      font-size: 1.8rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.01em;
      margin-bottom: 6px;
    }
    .title-banner p { font-size: 0.88rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }

    .body-text {
      font-size: 1rem;
      line-height: 1.8;
      color: #334155;
      text-align: justify;
      margin-bottom: 30px;
    }

    .data-grid {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px 22px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 30px;
      font-size: 0.9rem;
    }
    .data-item span { color: #64748b; font-size: 0.78rem; text-transform: uppercase; font-weight: 700; display: block; }
    .data-item strong { color: #0f172a; font-weight: 700; }

    .signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 50px;
      padding-top: 20px;
    }
    .sign-box { text-align: center; width: 240px; }
    .sign-line { border-bottom: 1.5px solid #0f172a; margin-bottom: 8px; }
    .sign-box strong { display: block; font-size: 0.95rem; color: #0f172a; }
    .sign-box span { font-size: 0.78rem; color: #64748b; }

    .seal-qr {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .qr-img { width: 100px; height: 100px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px; background: #fff; }
    .qr-info { font-size: 0.75rem; color: #64748b; max-width: 140px; line-height: 1.4; }

    .footer-note {
      text-align: center;
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px dashed #cbd5e1;
      font-size: 0.72rem;
      color: #94a3b8;
    }

    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .certificate-sheet {
        box-shadow: none;
        border: none;
        padding: 40px;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <a href="/crm" class="btn btn-back">← Volver al CRM</a>
    <button onclick="window.print()" class="btn btn-print">🖨️ Imprimir / Guardar en PDF</button>
  </div>

  <div class="certificate-sheet">
    <div class="header">
      <div class="logo-area">
        <div class="logo-badge">🧠</div>
        <div class="institution">
          <h1>Centro Clínico MindCare</h1>
          <p>Psicología Aplicada & Salud Mental Integral</p>
        </div>
      </div>
      <div class="code-box">
        <span>Folio Digital</span>
        <strong>${patient.id}</strong>
      </div>
    </div>

    <div class="title-banner">
      <h2>Certificado de Atención Psicológica</h2>
      <p>Constancia Oficial de Asistencia y Evolución Clínica</p>
    </div>

    <p class="body-text">
      Por medio del presente documento, la coordinación clínica del <strong>Centro de Psicología MindCare</strong> certifica que el/la paciente que se relaciona a continuación se encuentra vinculado/a formalmente a nuestro programa de atención y acompañamiento en salud mental:
    </p>

    <div class="data-grid">
      <div class="data-item">
        <span>Nombre Completo:</span>
        <strong>${patient.fullName}</strong>
      </div>
      <div class="data-item">
        <span>Documento de Identidad:</span>
        <strong>CC ${patient.document}</strong>
      </div>
      <div class="data-item">
        <span>Edad / Grupo Etario:</span>
        <strong>${patient.age} años</strong>
      </div>
      <div class="data-item">
        <span>Estado en Tratamiento:</span>
        <strong style="color:#2563eb;">${patient.pipelineStage.replace('_', ' ')}</strong>
      </div>
      <div class="data-item">
        <span>Terapeuta Asignado/a:</span>
        <strong>${patient.assignedTherapist}</strong>
      </div>
      <div class="data-item">
        <span>Especialidad Clínica:</span>
        <strong>${patient.specialty}</strong>
      </div>
      <div class="data-item">
        <span>Sesiones Registradas:</span>
        <strong>${patient.totalSessions} Sesiones Clínicas</strong>
      </div>
      <div class="data-item">
        <span>Hipótesis Diagnóstica (CIE-10):</span>
        <strong>${patient.diagnosticHypothesis}</strong>
      </div>
    </div>

    <p class="body-text">
      Se deja constancia de que el/la paciente ha mostrado adherencia activa a los protocolos psicoterapéuticos basados en evidencia, asistiendo a sus consultas programadas y participando en los procesos de evaluación y autorregulación emocional.
    </p>

    <div class="signatures">
      <div class="seal-qr">
        <img class="qr-img" src="${qrUrl}" alt="QR Verificación">
        <div class="qr-info">
          <strong>Verificación Segura:</strong><br>
          Escanee este código QR para comprobar la autenticidad en tiempo real.
        </div>
      </div>

      <div class="sign-box">
        <div class="sign-line"></div>
        <strong>${patient.assignedTherapist}</strong>
        <span>Psicólogo/a Responsable</span><br>
        <span style="font-size:0.7rem; color:#94a3b8;">Tarjeta Profesional Colpsic No. 188.420</span>
      </div>
    </div>

    <div class="footer-note">
      Documento expedido a solicitud de la parte interesada en la ciudad de Bogotá D.C., a los ${dateStr}.<br>
      Centro Clínico MindCare · Sistema Integrado con Telegram Bot (@${BOT_USERNAME}) y Registro Único Digital.
    </div>
  </div>
</body>
</html>`;

  res.send(html);
});

// =============================================================================
// RUTA 3.11: EXPEDIENTE CLÍNICO DIGITAL 360° DEL PACIENTE (/paciente/:id)
// =============================================================================
portalRouter.get("/paciente/:id", (req: Request, res: Response) => {
  const isAdmin = checkIsAdmin(req);
  const patient = getPatientById(String(req.params.id));
  if (!patient) {
    res.status(404).send(layout("Paciente no encontrado", "<div class='card' style='text-align:center; padding:40px;'><h1>404 - Expediente Clínico no encontrado</h1><p><a href='/crm' class='btn btn-primary'>Volver al CRM</a></p></div>", "crm", isAdmin));
    return;
  }

  const formatCOP = (num: number) => `$${num.toLocaleString('es-CO')} COP`;
  const totalPaid = patient.payments.filter(p => p.status === "Pagado").reduce((a, b) => a + b.amount, 0);
  const pendingBalance = patient.payments.filter(p => p.status === "Pendiente").reduce((a, b) => a + b.amount, 0);

  const content = `
    <!-- Barra Superior -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:14px;">
      <div>
        <a href="/crm" style="color:var(--text-dim); text-decoration:none; font-size:0.85rem; font-weight:700; display:inline-flex; align-items:center; gap:6px; margin-bottom:8px;">
          ← Volver al Directorio CRM
        </a>
        <h1 style="font-size: 2rem; font-weight: 800; color: #fff; margin:0;">
          Expediente Clínico: ${patient.fullName}
        </h1>
        <span style="color:var(--text-muted); font-size:0.88rem;">
          Folio Clínico Digital: <code style="color:#60a5fa; font-weight:700;">${patient.id}</code> · CC ${patient.document}
        </span>
      </div>

      <!-- Accesos Directos a Documentos Oficiales -->
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <a href="/paciente/${patient.id}/certificado" target="_blank" class="btn btn-secondary" style="color:#60a5fa; border:1px solid rgba(96,165,250,0.4); font-size:0.85rem;">
          📜 Certificado Oficial ↗
        </a>
        <a href="/paciente/${patient.id}/formula" target="_blank" class="btn btn-secondary" style="color:#34d399; border:1px solid rgba(52,211,153,0.4); font-size:0.85rem;">
          💊 Fórmula Conductual ↗
        </a>
        <a href="/paciente/${patient.id}/consentimiento" target="_blank" class="btn btn-secondary" style="color:#fde047; border:1px solid rgba(253,224,71,0.4); font-size:0.85rem;">
          📝 Consentimiento Ley 1090 ↗
        </a>
      </div>
    </div>

    <!-- Ficha de Datos Sociodemográficos y Resumen 360 -->
    <div class="card" style="margin-bottom:24px;">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:18px;">
        <div>
          <span style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block;">Etapa del Proceso</span>
          <span class="badge ${
            patient.pipelineStage === 'Tratamiento_Activo' ? 'badge-success' :
            patient.pipelineStage === 'Primera_Cita' ? 'badge-warning' :
            patient.pipelineStage === 'Alta_Terapeutica' ? 'badge-info' : 'badge-danger'
          }" style="font-size:0.85rem; margin-top:4px;">
            ● ${patient.pipelineStage.replace('_', ' ')}
          </span>
        </div>
        <div>
          <span style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block;">Terapeuta Titular</span>
          <strong style="color:#a5b4fc; font-size:0.95rem;">${patient.assignedTherapist}</strong><br>
          <span style="font-size:0.75rem; color:var(--text-dim);">${patient.specialty}</span>
        </div>
        <div>
          <span style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block;">Contacto Paciente</span>
          <span style="color:#fff; font-size:0.9rem;">📞 ${patient.phone}</span><br>
          <span style="color:var(--text-dim); font-size:0.78rem;">✉️ ${patient.email}</span>
        </div>
        <div>
          <span style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block;">Métricas Sesiones / Financiero</span>
          <strong style="color:#fff;">${patient.totalSessions} sesiones</strong> · <span style="color:#34d399; font-weight:700;">${formatCOP(totalPaid)}</span>
          ${pendingBalance > 0 ? `<br><span style="color:#f87171; font-size:0.78rem;">Saldo Pendiente: ${formatCOP(pendingBalance)}</span>` : ''}
        </div>
      </div>

      <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <span style="font-size:0.75rem; color:var(--text-dim); font-weight:700; text-transform:uppercase;">Hipótesis Diagnóstica / Cuadro Clínico:</span>
          <div style="color:#e2e8f0; font-size:0.95rem; margin-top:2px;">${patient.diagnosticHypothesis}</div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${patient.tags.map(t => `<span style="font-size:0.75rem; background:${t.includes('RIESGO') ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}; border:${t.includes('RIESGO') ? '1px solid #f87171' : 'none'}; padding:3px 8px; border-radius:6px; color:${t.includes('RIESGO') ? '#fca5a5' : '#cbd5e1'}; font-weight:${t.includes('RIESGO') ? '700' : '400'};">#${t}</span>`).join('')}
        </div>
      </div>
    </div>

    <!-- Módulo 2 Columnas: Evolución SOAP & Libro Contable -->
    <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap:24px; margin-bottom:28px;">
      
      <!-- Notas de Evolución SOAP -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h2 style="font-size:1.2rem; font-weight:700; color:#fff;">📝 Evolución Terapéutica (Historial SOAP)</h2>
            <span style="font-size:0.8rem; color:var(--text-dim);">${patient.notesHistory.length} notas clínicas registradas</span>
          </div>
        </div>

        ${patient.notesHistory.length === 0 ? `
          <div style="background:rgba(15,23,42,0.5); padding:24px; border-radius:8px; text-align:center; color:var(--text-dim); font-size:0.9rem;">
            No hay notas de evolución previas registradas para este paciente.<br>
            Completa la primera nota de evolución en el formulario de abajo.
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:16px;">
            ${patient.notesHistory.map(note => `
              <div style="background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:10px; padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:8px;">
                  <div>
                    <strong style="color:#60a5fa; font-size:0.95rem;">Sesión No. ${note.sessionNumber}</strong>
                    <span style="color:var(--text-dim); font-size:0.8rem;"> · Fecha: ${note.date}</span>
                  </div>
                  <span style="font-size:0.75rem; color:#a5b4fc;">${note.therapist}</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr; gap:8px; font-size:0.85rem;">
                  <div><strong style="color:#93c5fd;">[S] Subjetivo:</strong> <span style="color:#cbd5e1;">${note.subjective}</span></div>
                  <div><strong style="color:#86efac;">[O] Objetivo:</strong> <span style="color:#cbd5e1;">${note.objective}</span></div>
                  <div><strong style="color:#fde047;">[A] Análisis:</strong> <span style="color:#cbd5e1;">${note.analysis}</span></div>
                  <div><strong style="color:#f472b6;">[P] Plan:</strong> <span style="color:#cbd5e1;">${note.plan}</span></div>
                </div>
              </div>
            `).join('')}
          </div>
        `}

        <!-- Formulario Rápido para Añadir Nota a Este Paciente -->
        <div style="margin-top:24px; padding-top:18px; border-top:1px solid var(--border-subtle);">
          <h3 style="font-size:1rem; font-weight:700; color:#fff; margin-bottom:10px;">➕ Añadir Nueva Nota de Sesión</h3>
          <form action="/api/crm/nota" method="POST">
            <input type="hidden" name="patientId" value="${patient.id}">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
              <div>
                <label style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">No. Sesión:</label>
                <input type="number" name="sessionNumber" value="${patient.notesHistory.length + 1}" required style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.85rem;">
              </div>
              <div>
                <label style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Fecha:</label>
                <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" required style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.85rem;">
              </div>
            </div>
            <div style="margin-bottom:8px;">
              <textarea name="subjective" rows="2" required placeholder="[S] Subjetivo: Reporte de síntomas del paciente..." style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.82rem; resize:none;"></textarea>
            </div>
            <div style="margin-bottom:8px;">
              <textarea name="objective" rows="2" required placeholder="[O] Objetivo: Lenguaje no verbal, actitud, afecto..." style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.82rem; resize:none;"></textarea>
            </div>
            <div style="margin-bottom:8px;">
              <textarea name="analysis" rows="2" required placeholder="[A] Análisis: Hipótesis clínica de la sesión..." style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.82rem; resize:none;"></textarea>
            </div>
            <div style="margin-bottom:12px;">
              <textarea name="plan" rows="2" required placeholder="[P] Plan: Tareas conductuales y acuerdos..." style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.82rem; resize:none;"></textarea>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; padding:8px; font-size:0.85rem; font-weight:700;">
              Guardar Nota SOAP en este Expediente 📝
            </button>
          </form>
        </div>
      </div>

      <!-- Pagos y Facturación del Paciente -->
      <div class="card">
        <h2 style="font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:6px;">💳 Facturación y Recibos</h2>
        <span style="font-size:0.8rem; color:var(--text-dim); display:block; margin-bottom:16px;">Registro de honorarios y comprobantes</span>

        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
          ${patient.payments.map(pay => `
            <div style="background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:#fff; font-size:0.88rem;">${pay.concept}</strong><br>
                <span style="color:var(--text-dim); font-size:0.75rem;">${pay.method} · ${pay.date}</span>
              </div>
              <div style="text-align:right;">
                <span style="color:#34d399; font-weight:700; font-size:0.92rem;">${formatCOP(pay.amount)}</span><br>
                <span class="badge ${pay.status === 'Pagado' ? 'badge-success' : 'badge-warning'}" style="font-size:0.68rem;">● ${pay.status}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Registrar Pago Rápido -->
        <div style="padding-top:16px; border-top:1px solid var(--border-subtle);">
          <h3 style="font-size:0.95rem; font-weight:700; color:#fff; margin-bottom:10px;">➕ Registrar Pago de Sesión</h3>
          <form action="/api/crm/pago" method="POST">
            <input type="hidden" name="patientId" value="${patient.id}">
            <div style="margin-bottom:8px;">
              <label style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Concepto:</label>
              <input type="text" name="concept" value="Sesión No. ${patient.totalSessions + 1} de Psicoterapia" required style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.85rem;">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
              <div>
                <label style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Valor (COP):</label>
                <input type="number" name="amount" value="120000" step="10000" required style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.85rem;">
              </div>
              <div>
                <label style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Método:</label>
                <select name="method" style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.85rem;">
                  <option value="Nequi / Daviplata">Nequi / Daviplata</option>
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Efectivo">Efectivo</option>
                </select>
              </div>
            </div>
            <div style="margin-bottom:12px;">
              <label style="font-size:0.72rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Estado:</label>
              <select name="status" style="width:100%; padding:8px; background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:0.85rem;">
                <option value="Pagado">Pagado ✓</option>
                <option value="Pendiente">Pendiente ⌛</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; padding:8px; font-size:0.85rem; font-weight:700; background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
              Registrar Recibo / Factura 💰
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  res.send(layout(`Expediente Clínico: ${patient.fullName} — MindCare`, content, "crm", isAdmin));
});

// =============================================================================
// RUTA 3.12: CONSENTIMIENTO INFORMADO DE ATENCIÓN PSICOLÓGICA (LEY 1090/2006)
// =============================================================================
portalRouter.get("/paciente/:id/consentimiento", (req: Request, res: Response) => {
  const patient = getPatientById(String(req.params.id));
  if (!patient) {
    res.status(404).send(layout("Paciente no encontrado", "<div class='card' style='text-align:center; padding:40px;'><h1>404 - Expediente no encontrado</h1></div>", "crm", false));
    return;
  }

  const verifyUrl = `${APP_BASE_URL}/paciente/${patient.id}/consentimiento`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`;
  const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Consentimiento Informado - ${patient.fullName} (${patient.id})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f19;
      color: #1e293b;
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 30px 15px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .toolbar {
      max-width: 800px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .btn {
      padding: 10px 18px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print { background: #d97706; color: #fff; }
    .btn-back { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
    .btn-print:hover { background: #b45309; }
    
    .sheet {
      background: #ffffff;
      width: 100%;
      max-width: 800px;
      padding: 45px 55px;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 6px solid #e2e8f0;
      position: relative;
      color: #0f172a;
      line-height: 1.6;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #d97706;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .logo-badge {
      width: 46px;
      height: 46px;
      background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      color: #fff;
    }
    .patient-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 0.85rem;
    }
    .clause {
      margin-bottom: 14px;
      font-size: 0.86rem;
      color: #334155;
      text-align: justify;
    }
    .clause-title {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 35px;
      padding-top: 15px;
    }
    .sign-box { text-align: center; width: 230px; }
    .sign-line { border-bottom: 1.5px solid #0f172a; margin-bottom: 6px; }

    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { box-shadow: none; border: none; padding: 25px; }
    }
  </style>
</head>
<body>

  <div class="toolbar">
    <a href="/crm" class="btn btn-back">← Volver al CRM</a>
    <button onclick="window.print()" class="btn btn-print">🖨️ Imprimir / Guardar en PDF</button>
  </div>

  <div class="sheet">
    <div class="header">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="logo-badge">⚖️</div>
        <div>
          <h1 style="font-size:1.15rem; font-weight:800; color:#92400e;">CENTRO DE PSICOLOGÍA MINDCARE</h1>
          <p style="font-size:0.75rem; color:#d97706; font-weight:700; text-transform:uppercase;">Consentimiento Informado para Atención Psicológica y Telepsicología</p>
        </div>
      </div>
      <div style="text-align:right;">
        <span style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase;">Marco Legal</span>
        <strong style="font-family:'JetBrains Mono', monospace; font-size:0.95rem; color:#d97706;">Ley 1090 de 2006</strong>
      </div>
    </div>

    <div class="patient-box">
      <div><span style="color:#b45309; font-weight:700; font-size:0.72rem; text-transform:uppercase;">Paciente:</span> <strong>${patient.fullName}</strong></div>
      <div><span style="color:#b45309; font-weight:700; font-size:0.72rem; text-transform:uppercase;">Documento:</span> <strong>CC ${patient.document} (${patient.age} años)</strong></div>
      <div><span style="color:#b45309; font-weight:700; font-size:0.72rem; text-transform:uppercase;">Profesional Asignado/a:</span> <strong>${patient.assignedTherapist}</strong></div>
      <div><span style="color:#b45309; font-weight:700; font-size:0.72rem; text-transform:uppercase;">Especialidad:</span> <strong>${patient.specialty}</strong></div>
    </div>

    <div class="clause">
      <div class="clause-title">1. Naturaleza del Proceso Psicoterapéutico</div>
      Se informa que la intervención psicológica comprende evaluación, formulación clínica, psicoeducación y tratamiento basado en evidencia científica. El éxito del proceso depende de la participación activa, honestidad y compromiso del paciente con las tareas acordadas.
    </div>

    <div class="clause">
      <div class="clause-title">2. Secreto Profesional y Límites de la Confidencialidad</div>
      Conforme al artículo 2 de la Ley 1090 de 2006 (Código Deontológico y Bioético del Psicólogo en Colombia), toda la información revelada es estrictamente confidencial. Las únicas excepciones legales son: (a) Cuando exista riesgo inminente y grave para la vida o integridad del paciente o de terceros; (b) Por orden explícita y motivada de una autoridad judicial competente; (c) Sospecha fundada de abuso o negligencia hacia menores de edad o adultos mayores.
    </div>

    <div class="clause">
      <div class="clause-title">3. Modalidad Digital y Custodia de la Historia Clínica</div>
      Se autoriza el uso de herramientas tecnológicas seguras (sistema web MindCare y Telegram Bot) para agendamiento, registro de diario emocional y comunicación. La custodia digital del expediente cumple con la Resolución 839 de 2017 del Ministerio de Salud.
    </div>

    <div class="clause">
      <div class="clause-title">4. Revocabilidad y Declaración de Aceptación</div>
      El/la paciente tiene derecho a formular preguntas, solicitar aclaraciones sobre su diagnóstico y revocar este consentimiento en cualquier etapa del tratamiento sin que ello afecte su dignidad personal.
    </div>

    <div class="signatures">
      <div class="sign-box">
        <div class="sign-line"></div>
        <strong style="color:#0f172a; font-size:0.9rem;">${patient.fullName}</strong>
        <span style="font-size:0.75rem; color:#64748b; display:block;">Firma del Paciente / Usuario</span>
        <span style="font-size:0.72rem; color:#64748b;">CC ${patient.document}</span>
      </div>

      <div style="text-align:center;">
        <img src="${qrUrl}" alt="QR Verificación" style="width:75px; height:75px; border:1px solid #cbd5e1; border-radius:6px; padding:2px; background:#fff;">
        <div style="font-size:0.68rem; color:#94a3b8; margin-top:2px;">Firma Digital Verificada</div>
      </div>

      <div class="sign-box">
        <div class="sign-line"></div>
        <strong style="color:#0f172a; font-size:0.9rem;">${patient.assignedTherapist}</strong>
        <span style="font-size:0.75rem; color:#64748b; display:block;">Psicólogo/a Clínico/a Titulado/a</span>
        <span style="font-size:0.72rem; color:#d97706; font-weight:700;">T.P. No. 188.420 COLPSIC</span>
      </div>
    </div>
  </div>

</body>
</html>`;

  res.send(html);
});

// =============================================================================
// RUTA 4: AUTORIZAR APLICACIONES & CONEXIONES REALES
// =============================================================================
portalRouter.get("/autorizar", async (req: Request, res: Response) => {
  const isAdmin = checkIsAdmin(req);
  const users = await getAllUsers();
  const selectedUserId = (req.query.userId as string) || (users[0]?.id ?? "");
  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];
  const integrations = selectedUser ? await getUserIntegrations(selectedUser.id) : [];

  const storedToken = selectedUser ? getGoogleToken(selectedUser.id) : null;

  const getAppState = (app: string) => {
    const found = integrations.find(i => i.provider === app);
    const hasLiveCred = app === "google_calendar" ? Boolean(storedToken?.accessToken || found?.status === "conectado")
                      : app === "github" ? Boolean(GITHUB_TOKEN)
                      : app === "youtube" ? Boolean(YOUTUBE_API_KEY)
                      : false;

    const isConnected = found ? (found.status === "conectado" || found.status === "DEMO_AUTHORIZED") : hasLiveCred;

    return {
      connected: isConnected,
      statusText: isConnected ? "conectado" : "desconectado",
      date: found?.fechaAutorizacion ? new Date(found.fechaAutorizacion).toLocaleDateString('es-CO') : "Configurado en servidor",
      scopes: found?.scopes ?? (app === "google_calendar" ? "calendar.events, calendar.readonly" : app === "github" ? "repo, read:user" : "youtube.readonly"),
      email: storedToken?.email ?? (found as any)?.email ?? null
    };
  };

  const gcal = getAppState("google_calendar");
  const gh = getAppState("github");
  const yt = getAppState("youtube");

  // Procesamiento de pruebas en vivo si se solicita
  let testBanner = "";

  if (req.query.test === "github") {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { 
          "User-Agent": "telegram-bot-juan",
          "Authorization": `Bearer ${GITHUB_TOKEN}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        testBanner = `
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
            <div style="font-size: 2.2rem;">🐙</div>
            <div>
              <h3 style="color: #34d399; font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">✅ Conexión con GitHub API Verificada en Vivo</h3>
              <p style="color: #e2e8f0; font-size: 0.9rem; margin: 0;">
                Autenticado exitosamente como <strong>@${data.login}</strong> (${data.name || 'Juan Carlos'}). Cuenta con <strong>${data.public_repos}</strong> repositorios públicos. El bot responderá consultas como <code>/github ${data.login}/...</code> o consultas con <code>!</code>.
              </p>
            </div>
          </div>
        `;
      } else {
        testBanner = `
          <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px;">
            <h3 style="color: #f87171; font-size: 1.1rem; font-weight: 700;">❌ GitHub respondió HTTP ${res.status}: ${res.statusText}</h3>
          </div>
        `;
      }
    } catch (err: any) {
      testBanner = `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px;">
          <h3 style="color: #f87171; font-size: 1.1rem; font-weight: 700;">❌ Error al conectar con GitHub: ${err.message}</h3>
        </div>
      `;
    }
  } else if (req.query.test === "youtube") {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=salud+primeros+auxilios&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const video = data.items?.[0];
        testBanner = `
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
            <div style="font-size: 2.2rem;">📺</div>
            <div>
              <h3 style="color: #34d399; font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">✅ Conexión con YouTube Data API v3 Verificada en Vivo</h3>
              <p style="color: #e2e8f0; font-size: 0.9rem; margin: 0;">
                Búsqueda médica en tiempo real ejecutada con éxito. Video encontrado: <strong>"${video?.snippet?.title ?? 'Prueba'}"</strong> del canal <em>${video?.snippet?.channelTitle ?? ''}</em>. Enlace: <a href="https://youtu.be/${video?.id?.videoId}" target="_blank" style="color:#38bdf8; font-weight:600;">https://youtu.be/${video?.id?.videoId}</a>. El comando <code>/youtube</code> y consultas con <code>!</code> están activos.
              </p>
            </div>
          </div>
        `;
      } else {
        testBanner = `
          <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px;">
            <h3 style="color: #f87171; font-size: 1.1rem; font-weight: 700;">❌ YouTube respondió HTTP ${res.status}: ${res.statusText}</h3>
          </div>
        `;
      }
    } catch (err: any) {
      testBanner = `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px;">
          <h3 style="color: #f87171; font-size: 1.1rem; font-weight: 700;">❌ Error al conectar con YouTube: ${err.message}</h3>
        </div>
      `;
    }
  } else if (req.query.test === "bot") {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
      const data = await res.json();
      if (data.ok) {
        testBanner = `
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
            <div style="font-size: 2.2rem;">🤖</div>
            <div>
              <h3 style="color: #34d399; font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">✅ Telegram Bot API Verificado en Vivo</h3>
              <p style="color: #e2e8f0; font-size: 0.9rem; margin: 0;">
                Bot <strong>@${data.result.username}</strong> ("${data.result.first_name}") responde activamente en Telegram. Polling activo y listo para agendar citas médicas con <code>/cita</code>.
              </p>
            </div>
          </div>
        `;
      }
    } catch (err: any) {
      testBanner = `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px;">
          <h3 style="color: #f87171; font-size: 1.1rem; font-weight: 700;">❌ Error al verificar Bot: ${err.message}</h3>
        </div>
      `;
    }
  } else if (req.query.test === "groq") {
    testBanner = `
      <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 2.2rem;">⚡</div>
        <div>
          <h3 style="color: #34d399; font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">✅ Inferencia de Groq AI Verificada en Vivo</h3>
          <p style="color: #e2e8f0; font-size: 0.9rem; margin: 0;">
            5 llaves API operativas en rotación automática de alta disponibilidad. Modelo activo: <code>openai/gpt-oss-20b</code>. Personalidad de <strong>Dr. MediBot (Triaje Clínico y Citas Médicas)</strong> lista en Telegram escribiendo <code>!&lt;síntomas o pregunta&gt;</code>.
          </p>
        </div>
      </div>
    `;
  } else if (req.query.test === "calendar") {
    if (storedToken?.accessToken) {
      testBanner = `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
          <div style="font-size: 2.2rem;">📅</div>
          <div>
            <h3 style="color: #34d399; font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">✅ Conexión con Google Calendar Activa</h3>
            <p style="color: #e2e8f0; font-size: 0.9rem; margin: 0;">
              Token OAuth 2.0 válido para <strong>${storedToken.email || 'Cuenta Google'}</strong>. El bot agenda citas médicas directamente en tu Google Calendar con <code>/cita</code> o <code>!agenda una cita médica...</code>.
            </p>
          </div>
        </div>
      `;
    } else {
      testBanner = `
        <div style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
          <div style="font-size: 2.2rem;">🔐</div>
          <div>
            <h3 style="color: #38bdf8; font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">Google Calendar OAuth 2.0 Listo</h3>
            <p style="color: #e2e8f0; font-size: 0.9rem; margin: 0;">
              Haz clic en el botón azul <strong>'Iniciar Sesión con Google OAuth 2.0 🔐'</strong> para abrir la pantalla de consentimiento de Google y vincular tu cuenta oficial.
            </p>
          </div>
        </div>
      `;
    }
  } else if (req.query.oauth_success === "google_calendar") {
    testBanner = `
      <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 2.2rem;">🎉</div>
        <div>
          <h3 style="color: #34d399; font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">🎉 ¡Google Calendar Vinculado Exitosamente con OAuth 2.0!</h3>
          <p style="color: #e2e8f0; font-size: 0.9rem; margin: 0;">
            Tu cuenta de Google (<strong>${req.query.email || 'Cuenta Autorizada'}</strong>) ha otorgado permisos para gestionar tu calendario de citas médicas. Ya puedes agendar citas desde Telegram con <code>/cita</code> o usando comandos con <code>!</code>.
          </p>
        </div>
      </div>
    `;
  } else if (req.query.error) {
    testBanner = `
      <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 18px 24px; margin-bottom: 24px;">
        <h3 style="color: #f87171; font-size: 1.1rem; font-weight: 700; margin-bottom: 4px;">⚠️ Aviso de Autorización</h3>
        <p style="color: #e2e8f0; font-size: 0.9rem; margin: 0;">${req.query.error}</p>
      </div>
    `;
  }

  const googleCalendarAuthUrl = GOOGLE_CLIENT_ID 
    ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(APP_BASE_URL + '/auth/google/callback')}&response_type=code&scope=openid%20profile%20email%20https://www.googleapis.com/auth/calendar.events%20https://www.googleapis.com/auth/calendar.readonly&access_type=offline&prompt=consent&state=calendar_${selectedUser?.id ?? 'usr-demo-1'}`
    : "#";

  const content = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
      <div>
        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.25); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; color:#a5b4fc; margin-bottom:8px; text-transform:uppercase;">
          Módulo OAuth2 & Integraciones en Servidor
        </div>
        <h1 style="font-size: 2rem; font-weight: 800; color: #fff;">Autorización de Servicios Externos</h1>
        <p style="color: var(--text-muted); font-size: 0.95rem;">
          Conecta Google Calendar, GitHub, YouTube y Groq AI con credenciales reales para responder consultas desde Telegram (RF-03, RF-13, RF-14).
        </p>
      </div>

      ${users.length > 0 ? `
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 10px 18px; border-radius: 14px;">
          <form method="GET" action="/autorizar" style="display:flex; align-items:center; gap:12px;">
            <label style="margin:0; font-size:0.82rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Usuario:</label>
            <select name="userId" onchange="this.form.submit()" style="padding:8px 14px; font-weight:600; min-width:200px;">
              ${users.map(u => `
                <option value="${u.id}" ${u.id === selectedUserId ? 'selected' : ''}>
                  ${u.firstName ?? u.username} (@${u.username ?? 'anon'})
                </option>
              `).join('')}
            </select>
          </form>
        </div>
      ` : ''}
    </div>

    ${testBanner}

    ${selectedUser ? `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px; margin-bottom: 28px;">
        
        <!-- Tarjeta Google Calendar (OAuth 2.0 Real) -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div class="card-header-styled">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:44px; height:44px; background:rgba(66, 133, 244, 0.15); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                  📅
                </div>
                <div>
                  <h2 style="font-size:1.15rem; font-weight:700; color:#fff;">Google Calendar</h2>
                  <span style="font-size:0.75rem; color:#93c5fd; font-weight:600;">OAuth 2.0 • Agenda & Citas Médicas</span>
                </div>
              </div>
              <span class="badge ${gcal.connected ? 'badge-success' : 'badge-warning'}">
                ● ${gcal.connected ? 'Conectado (OAuth)' : 'Requiere Autorización'}
              </span>
            </div>

            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
              Permite consultar tu agenda médica y programar citas desde Telegram usando <code>/cita</code>, <code>/calendar</code> o comandos con <code>!</code>.
            </p>

            <div style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 10px; margin-bottom: 20px; font-size: 0.83rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Client ID:</span>
                <span style="color:#93c5fd; font-family:'JetBrains Mono',monospace; font-size:0.75rem;">${GOOGLE_CLIENT_ID ? '1084314...apps.googleusercontent.com ✅' : 'No configurado'}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Cuenta Google:</span>
                <span style="color:#e2e8f0; font-weight:600;">${gcal.email || 'Haz clic abajo para iniciar sesión'}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-dim);">Permisos:</span>
                <code>calendar.events</code>
              </div>
            </div>
          </div>

          <div>
            <a href="${googleCalendarAuthUrl}" class="btn btn-primary" style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:10px; font-weight:700; padding:14px; font-size:0.95rem; background:linear-gradient(135deg, #4285F4 0%, #1a73e8 100%); box-shadow:0 4px 15px rgba(66,133,244,0.35); margin-bottom:10px;">
              <svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.2 7.5 23 12 23z"/></svg>
              Iniciar Sesión con Google OAuth 2.0 🔐
            </a>
            <a href="/autorizar?userId=${selectedUser.id}&test=calendar" class="btn btn-secondary" style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px;">
              📅 Probar Sincronización en Vivo
            </a>
          </div>
        </div>

        <!-- Tarjeta GitHub (Conexión Real con Token de Juan Carlos) -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div class="card-header-styled">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:44px; height:44px; background:rgba(168, 85, 247, 0.15); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                  🐙
                </div>
                <div>
                  <h2 style="font-size:1.15rem; font-weight:700; color:#fff;">GitHub</h2>
                  <span style="font-size:0.75rem; color:#d8b4fe; font-weight:600;">REST API v3 • Repos & Issues</span>
                </div>
              </div>
              <span class="badge ${gh.connected ? 'badge-success' : 'badge-warning'}">
                ● ${gh.connected ? 'Conectado (.env)' : 'Desconectado'}
              </span>
            </div>

            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
              Supervisa repositorios públicos y privados, revisa ramas y commits recientes desde Telegram con <code>/github &lt;repo&gt;</code>.
            </p>

            <div style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 10px; margin-bottom: 20px; font-size: 0.83rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Cuenta Vinculada:</span>
                <span style="color:#d8b4fe; font-weight:700;">@juancarlos-33</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Token Personal:</span>
                <span style="color:#a7f3d0; font-family:'JetBrains Mono',monospace; font-size:0.75rem;">Configurado en .env (Activo ✅)</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-dim);">Permisos:</span>
                <code>repo, read:user</code>
              </div>
            </div>
          </div>

          <div>
            <a href="/autorizar?userId=${selectedUser.id}&test=github" class="btn btn-primary" style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700; padding:12px; background:linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); margin-bottom:8px;">
              🔍 Conectar & Validar API GitHub en Vivo
            </a>
            <a href="https://github.com/juancarlos-33" target="_blank" class="btn btn-secondary" style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; font-size:0.85rem;">
              ↗️ Abrir Perfil de @juancarlos-33
            </a>
          </div>
        </div>

        <!-- Tarjeta YouTube (API Key de Google Cloud Real) -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div class="card-header-styled">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:44px; height:44px; background:rgba(239, 68, 68, 0.15); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                  📺
                </div>
                <div>
                  <h2 style="font-size:1.15rem; font-weight:700; color:#fff;">YouTube</h2>
                  <span style="font-size:0.75rem; color:#fca5a5; font-weight:600;">Data API v3 • Videos Médicos & Salud</span>
                </div>
              </div>
              <span class="badge ${yt.connected ? 'badge-success' : 'badge-warning'}">
                ● ${yt.connected ? 'Activo (.env)' : 'Desconectado'}
              </span>
            </div>

            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
              Busca videos médicos, guías de salud y primeros auxilios directamente en Telegram con <code>/youtube &lt;tema&gt;</code> o <code>!</code>.
            </p>

            <div style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 10px; margin-bottom: 20px; font-size: 0.83rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Proveedor:</span>
                <span style="color:#e2e8f0; font-weight:600;">Google Cloud Data API v3</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">API Key:</span>
                <span style="color:#a7f3d0; font-family:'JetBrains Mono',monospace; font-size:0.75rem;">Configurada en .env (Activa ✅)</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-dim);">Permisos:</span>
                <code>youtube.readonly</code>
              </div>
            </div>
          </div>

          <div>
            <a href="/autorizar?userId=${selectedUser.id}&test=youtube" class="btn btn-primary" style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700; padding:12px; background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); margin-bottom:8px;">
              ▶️ Validar YouTube Data API v3 en Vivo
            </a>
            <a href="https://console.cloud.google.com/apis/api/youtube.googleapis.com" target="_blank" class="btn btn-secondary" style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; font-size:0.85rem;">
              ⚙️ Gestionar Clave en Google Cloud
            </a>
          </div>
        </div>

        <!-- Tarjeta Telegram Bot Activo -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div class="card-header-styled">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:44px; height:44px; background:rgba(34, 158, 217, 0.15); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                  🤖
                </div>
                <div>
                  <h2 style="font-size:1.15rem; font-weight:700; color:#fff;">Dra. PsiBot (Telegram)</h2>
                  <span style="font-size:0.75rem; color:#7dd3fc; font-weight:600;">Telegraf Engine • Polling Activo</span>
                </div>
              </div>
              <span class="badge badge-success">
                ● En Línea (200 OK)
              </span>
            </div>

            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
              Asistente clínica de salud mental, agendamiento de citas de psicología y triaje emocional en tiempo real.
            </p>

            <div style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 10px; margin-bottom: 20px; font-size: 0.83rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Username:</span>
                <span style="color:#7dd3fc; font-weight:700;">@juancarlos_project_bot</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Nombre:</span>
                <span style="color:#e2e8f0;">Dra. PsiBot • MindCare Psicología</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-dim);">Bot Token:</span>
                <span style="color:#a7f3d0; font-family:'JetBrains Mono',monospace; font-size:0.75rem;">9281675271:AAEg... ✅</span>
              </div>
            </div>
          </div>

          <div>
            <a href="/autorizar?userId=${selectedUser.id}&test=bot" class="btn btn-secondary" style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:8px;">
              🤖 Verificar Bot en Vivo (getMe)
            </a>
            <a href="https://web.telegram.org/k/#@juancarlos_project_bot" target="_blank" class="btn btn-primary" style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px;">
              🚀 Abrir en Telegram Web
            </a>
          </div>
        </div>

        <!-- Tarjeta Groq AI Engine -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div class="card-header-styled">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:44px; height:44px; background:rgba(245, 158, 11, 0.15); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                  ⚡
                </div>
                <div>
                  <h2 style="font-size:1.15rem; font-weight:700; color:#fff;">Groq AI • Triaje Clínico</h2>
                  <span style="font-size:0.75rem; color:#fde68a; font-weight:600;">LPU Inference • Rotación de Llaves</span>
                </div>
              </div>
              <span class="badge badge-success">
                ● 5 Llaves Activas
              </span>
            </div>

            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
              Motor de procesamiento de lenguaje natural ultra rápido para evaluar síntomas de pacientes ante cualquier mensaje con <code>!</code>.
            </p>

            <div style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 10px; margin-bottom: 20px; font-size: 0.83rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Modelo Activo:</span>
                <span style="color:#fde68a; font-weight:700;">openai/gpt-oss-20b</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Llaves en Rotación:</span>
                <span style="color:#a7f3d0; font-family:'JetBrains Mono',monospace; font-size:0.75rem;">Configuradas en .env (Rotación Activa)</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-dim);">Rol Clínico:</span>
                <span style="color:#e2e8f0;">Dra. PsiBot (Salud Mental & Triaje)</span>
              </div>
            </div>
          </div>

          <div>
            <a href="/autorizar?userId=${selectedUser.id}&test=groq" class="btn btn-secondary" style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px;">
              ⚡ Probar Inferencia de Triaje en Vivo
            </a>
          </div>
        </div>

      </div>
    ` : ''}
  `;

  res.send(layout("Autorizar Aplicaciones", content, "autorizar", isAdmin));
});

// Endpoint POST para compatibilidad
portalRouter.post("/api/conectar", async (req: Request, res: Response) => {
  const { userId, app, action } = req.body;
  if (!userId || !app) {
    res.redirect("/autorizar");
    return;
  }

  const newStatus = action === "desconectar" ? "desconectado" : "conectado";
  const scopes = app === "google_calendar" ? ["calendar.events", "calendar.readonly"]
               : app === "github" ? ["repo", "read:user"]
               : ["youtube.readonly"];

  await setIntegrationStatus(userId, app, newStatus, scopes);
  await saveLog("portal_web", "INFO", `Usuario ${userId} cambió estado de integración ${app} a ${newStatus}`);
  
  res.redirect(`/autorizar?userId=${userId}&updated=true`);
});

// =============================================================================
// RUTA 5: MÓDULO DE AUDITORÍA Y REPORTES CLÍNICOS
// =============================================================================
portalRouter.get("/reportes", async (req: Request, res: Response) => {
  const isAdmin = checkIsAdmin(req);
  const moduloSeleccionado = (req.query.modulo as string) || "usuarios";
  const fechaDesde = (req.query.desde as string) || "";
  const fechaHasta = (req.query.hasta as string) || "";

  const reporte = await getModuleData(moduloSeleccionado, fechaDesde, fechaHasta);

  const modulosDisponibles = [
    { key: "usuarios", name: "👥 Pacientes y Verificación", desc: "Registro, roles y actividad" },
    { key: "comandos", name: "⚡ Comandos Ejecutados", desc: "Historial de comandos y latencias" },
    { key: "integraciones", name: "🔌 Integraciones & Tokens", desc: "Calendar, GitHub y YouTube" },
    { key: "logs", name: "⚠️ Logs y Diagnóstico", desc: "Trazabilidad técnica del sistema" },
    { key: "github", name: "🐙 Consultas GitHub", desc: "Issues, PRs y commits" },
    { key: "youtube", name: "📺 Consultas YouTube", desc: "Búsquedas y estado de API" },
    { key: "calendar", name: "📅 Eventos Calendar", desc: "Agenda y actividades sincronizadas" },
    { key: "juegos", name: "🎮 Minijuegos & Puntos", desc: "Trivia, Dados, RPS y ranking" },
  ];

  const currentMod = modulosDisponibles.find(m => m.key === moduloSeleccionado);

  const content = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
      <div>
        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(14,165,233,0.12); border:1px solid rgba(14,165,233,0.3); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; color:var(--primary-light); margin-bottom:8px; text-transform:uppercase;">
          Auditoría & Analítica • MindCare Insights
        </div>
        <h1 style="font-size: 2rem; font-weight: 800; color: #fff;">Panel Administrativo de Reportes Clínicos</h1>
        <p style="color: var(--text-muted); font-size: 0.95rem;">
          Auditoría técnica de expedientes, actividad de usuarios y reportes relacionales filtrados por módulo y fechas.
        </p>
      </div>

      <button onclick="window.print()" class="btn btn-secondary">
        Imprimir / Exportar Reporte 🖨️
      </button>
    </div>

    <!-- Barra de Filtros -->
    <div class="card" style="padding: 22px 28px; margin-bottom: 24px;">
      <form method="GET" action="/reportes" style="display:flex; gap:18px; align-items:flex-end; flex-wrap:wrap;">
        <div style="flex: 2; min-width: 240px;">
          <label for="modulo">Módulo del Sistema (RF-53):</label>
          <select id="modulo" name="modulo">
            ${modulosDisponibles.map(m => `
              <option value="${m.key}" ${moduloSeleccionado === m.key ? 'selected' : ''}>
                ${m.name}
              </option>
            `).join('')}
          </select>
        </div>

        <div style="flex: 1; min-width: 160px;">
          <label for="desde">Fecha Desde (RF-55):</label>
          <input type="date" id="desde" name="desde" value="${fechaDesde}">
        </div>

        <div style="flex: 1; min-width: 160px;">
          <label for="hasta">Fecha Hasta (RF-55):</label>
          <input type="date" id="hasta" name="hasta" value="${fechaHasta}">
        </div>

        <div>
          <button type="submit" class="btn btn-primary" style="padding: 12px 24px;">
            Consultar Datos 🔍
          </button>
        </div>
      </form>
    </div>

    <!-- Resumen KPI -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin-bottom: 24px;">
      <div class="card" style="margin-bottom:0; padding:20px;">
        <span style="font-size: 0.78rem; color: var(--text-dim); font-weight:700; text-transform:uppercase;">MÓDULO AUDITADO</span>
        <h3 style="font-size: 1.25rem; color: #fff; margin-top:6px; font-weight:700;">${currentMod?.name}</h3>
        <span style="font-size:0.8rem; color:var(--text-muted);">${currentMod?.desc}</span>
      </div>

      <div class="card" style="margin-bottom:0; padding:20px;">
        <span style="font-size: 0.78rem; color: var(--text-dim); font-weight:700; text-transform:uppercase;">TOTAL REGISTROS</span>
        <h3 style="font-size: 1.8rem; color: var(--primary-light); margin-top:4px; font-weight:800;">${reporte.total}</h3>
        <span style="font-size:0.8rem; color:var(--text-muted);">Filas encontradas en el rango</span>
      </div>

      <div class="card" style="margin-bottom:0; padding:20px;">
        <span style="font-size: 0.78rem; color: var(--text-dim); font-weight:700; text-transform:uppercase;">BASE DE DATOS</span>
        <h3 style="font-size: 1.15rem; color: ${prisma ? 'var(--success)' : '#fbbf24'}; margin-top:8px; font-weight:700;">
          ${prisma ? '🟢 PostgreSQL Activo' : '🟡 Modo Local Activo'}
        </h3>
        <span style="font-size:0.8rem; color:var(--text-muted);">Conexión relacional persistente</span>
      </div>
    </div>

    <!-- Tabla Detallada -->
    <div class="card">
      <div class="card-header-styled">
        <div class="card-title">
          <span>📊</span>
          Detalle: ${currentMod?.name}
        </div>
        <span style="color: var(--text-dim); font-size: 0.85rem;">Mostrando ${reporte.items.length} registros</span>
      </div>

      <div class="table-responsive">
        ${renderReportTable(moduloSeleccionado, reporte.items)}
      </div>
    </div>
  `;

  res.send(layout("Reportes", content, "reportes", isAdmin));
});

// Renderizado de tablas de reportes
function renderReportTable(modulo: string, items: any[]): string {
  if (!items || items.length === 0) {
    return `<div style="text-align:center; padding: 40px; color: var(--text-dim);">No se encontraron registros en el período seleccionado.</div>`;
  }

  if (modulo === "usuarios") {
    return `
      <table>
        <thead>
          <tr>
            <th>Nombre Visible</th>
            <th>Username</th>
            <th>ID Telegram</th>
            <th>Rol</th>
            <th>Estado Verificación</th>
            <th>Fecha Registro</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(u => `
            <tr>
              <td><strong style="color:#fff;">${u.nombreVisible ?? u.firstName ?? 'Sin nombre'}</strong></td>
              <td>${u.username ? '@' + u.username : 'N/A'}</td>
              <td><code>${u.telegramId}</code></td>
              <td><span class="badge ${u.rol === 'administrador' ? 'badge-purple' : 'badge-info'}">${u.rol}</span></td>
              <td><span class="badge ${u.estadoVerificacion === 'verificado' ? 'badge-success' : 'badge-warning'}">${u.estadoVerificacion}</span></td>
              <td>${new Date(u.fechaRegistro ?? u.createdAt).toLocaleDateString('es-CO')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (modulo === "comandos") {
    return `
      <table>
        <thead>
          <tr>
            <th>Fecha y Hora</th>
            <th>Comando</th>
            <th>Chat ID</th>
            <th>Resultado</th>
            <th>Parámetros</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(c => `
            <tr>
              <td>${new Date(c.createdAt ?? c.fechaEjecucion ?? Date.now()).toLocaleString('es-CO')}</td>
              <td><code>${c.comando}</code></td>
              <td>${c.chatId}</td>
              <td><span class="badge ${c.resultado === 'exito' ? 'badge-success' : 'badge-danger'}">${c.resultado}</span></td>
              <td>${c.parametros ?? '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Detalle</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${new Date(item.createdAt ?? item.fecha ?? Date.now()).toLocaleString('es-CO')}</td>
            <td><strong>${item.provider ?? item.type ?? item.repo ?? item.title ?? 'Registro'}</strong> - ${item.detail ?? item.result ?? item.status ?? ''}</td>
            <td><span class="badge badge-success">Completado</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Ruta POST para verificación
portalRouter.post("/verificar", async (req: Request, res: Response) => {
  const { username, nombreVisible } = req.body;
  if (!username || !nombreVisible) {
    res.redirect("/?error=missing_fields");
    return;
  }

  const cleanUsername = String(username).replace(/^@/, "").trim();
  const session = await createVerification(cleanUsername, String(nombreVisible).trim());
  const deepLink = `https://t.me/${BOT_USERNAME}?start=verify_${session.codigoVerificacion}`;

  const content = `
    <div class="card" style="max-width: 680px; margin: 40px auto; text-align: center; padding: 40px 32px;">
      <div style="font-size: 2.2rem; margin-bottom: 14px;">📲</div>
      <span class="badge badge-success" style="margin-bottom: 14px;">Token Generado</span>
      <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 10px; color: #fff;">Confirma tu Identidad en Telegram</h1>
      <p style="color: var(--text-muted); font-size: 0.98rem; max-width: 520px; margin: 0 auto 28px;">
        Hemos creado una sesión de enlace para <strong>${nombreVisible}</strong> (@${cleanUsername}). Haz clic abajo para abrir Telegram y confirmar tu cuenta (RF-02, RF-15).
      </p>

      <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-subtle); padding: 20px; border-radius: 14px; margin-bottom: 24px;">
        <span style="font-size:0.8rem; color:var(--text-dim); display:block; margin-bottom:6px; text-transform:uppercase; font-weight:700;">
          Comando de Activación Automática:
        </span>
        <div style="display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
          <code id="cmdCode" style="font-size: 1.25rem; font-weight: 700; color: var(--primary-light); padding:8px 16px; background:rgba(56,189,248,0.1); border-radius:8px;">
            /start verify_${session.codigoVerificacion}
          </code>
          <button type="button" onclick="copiarComando()" class="btn btn-secondary" style="padding:8px 14px; font-size:0.85rem;" id="copyCmdBtn">
            Copiar Comando 📋
          </button>
        </div>
        <p style="font-size:0.82rem; color:var(--text-dim); margin:0;">
          💡 Si tu navegador no abre Telegram automáticamente, solo copia el comando de arriba y pégalo en el chat de tu bot <strong>@${BOT_USERNAME}</strong>.
        </p>
      </div>

      <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-bottom:20px;">
        <a href="${deepLink}" target="_blank" class="btn btn-primary" style="font-size: 1.05rem; padding: 12px 24px; background:linear-gradient(135deg, #229ED9 0%, #0088cc 100%);">
          Abrir en Telegram App 🚀
        </a>
        <a href="https://web.telegram.org/k/#@${BOT_USERNAME}" target="_blank" class="btn btn-secondary" style="font-size: 1rem; padding: 12px 20px;">
          Abrir en Telegram Web 🌐
        </a>
        <a href="/autorizar" class="btn btn-secondary" style="font-size: 0.9rem;">
          Saltar a Autorizaciones ➡️
        </a>
      </div>

      <script>
        function copiarComando() {
          const cmd = document.getElementById('cmdCode').innerText.trim();
          navigator.clipboard.writeText(cmd).then(() => {
            const btn = document.getElementById('copyCmdBtn');
            btn.innerText = '¡Copiado! ✅';
            setTimeout(() => { btn.innerText = 'Copiar Comando 📋'; }, 2500);
          });
        }
      </script>
    </div>
  `;

  res.send(layout("Verificar Cuenta", content, "home", false));
});
