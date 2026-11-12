# 🧠 MindCare Psicología & Telegram Bot 🚀

> **Plataforma Integral de Salud Mental, Agendamiento Psicológico, CRM Clínico y Bot de Telegram Asistencial con IA.**

---

## 🌟 Características Principales

### 1. 🤖 Bot Asistente en Telegram (@juancarlos_project_bot)
- **Flujo Conversacional de Citas:** Agendamiento guiado paso a paso con botones interactivos y selección de especialidad.
- **Dra. PsiBot (IA Empática):** Detección y contención psicológica empática ante estados de angustia, ansiedad y tristeza sin interrumpir con formularios invasivos.
- **Protocolo de Crisis y Salvaguarda Inmediata (`/sos`, `/emergencia`):** Banners directos con líneas oficiales de ayuda gratuita (Líneas 106, 192 y 123) y marcado automático de riesgo (`⚠️ ALERTA_RIESGO`) en el CRM.
- **Batería Psicométrica Integrada:**
  - `PHQ-9`: Evaluación de severidad de depresión (9 reactivos clínicos).
  - `GAD-2`: Tamizaje rápido de ansiedad generalizada.
  - `PSS-4`: Escala de estrés percibido.
- **Herramientas Terapéuticas Activas:**
  - Reestructuración Cognitiva TCC (`/tcc`, `/pensamiento`).
  - Ejercicio guiado de respiración diafragmática 4-7-8 (`/respiracion`).
  - Registro de diario emocional (`/emocion`).

---

### 2. 💼 Portal Web y CRM Clínico 360°
- **Pipeline de Pacientes:** Clasificación en etapas clínicas (*Contacto Inicial, En Evaluación, Intervención Activa, Seguimiento, Alta Clínica*).
- **Expediente 360° (`/paciente/:id`):**
  - Historial de consultas y diagnósticos DSM-5 / CIE-10.
  - Notas de evolución en formato clínico estandarizado **SOAP** (*Subjetivo, Objetivo, Análisis, Plan*).
  - Registro contable de pagos y balance financiero por paciente.
- **Documentación Legal y Clínica:**
  - 📝 **Consentimiento Informado Ley 1090 de 2006:** Código Deontológico y Bioético del Psicólogo en Colombia con límites legales de confidencialidad.
  - 💊 **Fórmula / Prescripción Conductual:** Plan de intervención con código QR de verificación.
  - 📜 **Certificado Oficial de Atención Psicológica:** Constancia firmada para fines laborales o académicos.
  - 📥 **Exportador CSV:** Descarga directa de la base de datos a hojas de cálculo con codificación UTF-8.

---

### 3. 🛡️ Validaciones y Arquitectura
- **Detección de Colisiones de Agenda:** Validación en tiempo real para evitar que un terapeuta tenga cruces de horarios.
- **Normalización de Cédulas:** Prevención de duplicados sin importar formato de puntos o guiones.
- **Validación de Formularios:** Sanitización de campos, chequeo de montos positivos y correos válidos.

---

## 🛠️ Tecnologías

- **Runtime:** Node.js (ES Modules)
- **Lenguaje:** TypeScript
- **Bot Engine:** Telegraf.js
- **Servidor Web:** Express.js
- **ORM / Base de Datos:** Prisma ORM / SQLite / PostgreSQL
- **Estilos:** Glassmorphism UI con tema oscuro profesional

---

## 🚀 Instalación y Despliegue Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/juancarlos-33/telegram-bot-mindcare.git
   cd telegram-bot-mindcare
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
   Rellena con tus credenciales:
   - `BOT_TOKEN`: Token obtenido desde [@BotFather](https://t.me/BotFather)
   - `BOT_USERNAME`: `juancarlos_project_bot`
   - `PORT`: `3000`
   - `APP_BASE_URL`: `http://localhost:3000`

4. **Compilar y Ejecutar:**
   ```bash
   # Modo desarrollo
   npm run dev

   # Modo producción
   npm run build
   npm start
   ```

---

## 📍 Rutas del Sistema Web

| Ruta | Descripción |
| :--- | :--- |
| `/` | Portal principal de bienvenida |
| `/citas` | Agenda y reserva online de citas psicológicas |
| `/crm` | CRM y gestión de historias clínicas |
| `/paciente/:id` | Expediente 360°, notas SOAP y facturación |
| `/paciente/:id/consentimiento` | Consentimiento informado oficial (Ley 1090) |
| `/paciente/:id/formula` | Prescripción conductual con QR |
| `/paciente/:id/certificado` | Certificado oficial de asistencia |
| `/api/crm/export/csv` | Descarga de base de datos en CSV |

---

## 👨‍💻 Autor

Desarrollado por **Juan Carlos**  
GitHub: [@juancarlos-33](https://github.com/juancarlos-33)
