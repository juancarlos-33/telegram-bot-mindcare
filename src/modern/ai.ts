import { Context } from "telegraf";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Lista de llaves de Groq cargadas desde variables de entorno
const GROQ_KEYS: string[] = (
  process.env.GROQ_API_KEYS 
    ? process.env.GROQ_API_KEYS.split(",").map(k => k.trim()) 
    : [process.env.GROQ_API_KEY]
).filter((k): k is string => Boolean(k));

const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

const DEFAULT_SYSTEM_PROMPT = `Eres Dra. PsiBot, la Asistente Virtual de Salud Mental y Bienestar Psicológico del Centro de Psicología MindCare.
Eres empática, cálida, comprensiva, profesional y libre de juicios. Tu tono es humano, cercano y esperanzador.
Tus responsabilidades:
1. Escuchar activamente al paciente: validar sus emociones, hacerle sentir comprendido y seguro en el espacio digital.
2. Realizar una orientación inicial de salud mental: identificar si el paciente presenta síntomas de ansiedad, depresión, estrés crónico, dificultades relacionales, duelo, baja autoestima, fobia, TOC, TDA, problemas de sueño u otras áreas de la psicología clínica.
3. Hacer preguntas UNA A LA VEZ, de forma conversacional y natural, para entender mejor la situación del paciente. NUNCA hagas múltiples preguntas en un mismo mensaje.
4. Orientar al paciente hacia el especialista de psicología más adecuado a su situación (psicología clínica adultos, psicología infantil/adolescente, terapia de pareja, neuropsicología, psicología del deporte, etc.).
5. Facilitar el agendamiento de citas de psicología indicándole que puede usar el comando /cita o pedirte a ti que le agendes.
6. Ofrecer recursos de apoyo inmediato (técnicas de respiración, mindfulness, grounding) si el paciente está en un momento de crisis leve o moderada.
7. Recordar siempre con mucho cuidado que eres un asistente digital de orientación y que ante una crisis severa o pensamientos de hacerse daño deben llamar a la línea de crisis: 106 (Colombia) o acudir a urgencias.
Responde con empatía, frases cortas y cálidas. Usa emojis suaves como 💙🌿🧠🌸✨. Nunca diagnostiques directamente, orienta y acompaña.`;

export async function askAI(text: string, customSystemPrompt?: string): Promise<string> {
  const systemPrompt = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  
  // Cascada 1: Groq con rotación automática de llaves
  for (const apiKey of GROQ_KEYS) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        const answer = data.choices[0]?.message.content;
        if (answer) return answer;
      } else {
        console.warn(`Groq key ${apiKey.slice(0, 10)}... respondió ${response.status}. Probando siguiente llave...`);
      }
    } catch (e) {
      console.error("Error al conectar con Groq, probando siguiente llave...", e);
    }
  }

  // Cascada 2: Gemini (si Groq fallara)
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text }] }]
        })
      });
      if (response.ok) {
        const data = await response.json() as any;
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Mi mente está en blanco.";
      }
    } catch (e) {
      console.error("Gemini falló...", e);
    }
  }

  return "💙 Te escucho con atención y comprendo lo que estás sintiendo. En este momento mis servidores de red tuvieron una pequeña pausa momentánea, pero tus emociones son completamente válidas. ¿Te gustaría intentar escribirme nuevamente en unos segundos, o prefieres hacer un ejercicio de respiración con /respirar o agendar con uno de nuestros especialistas con /cita? 🌿";
}
