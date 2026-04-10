import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getTroubleshootingAdvice(equipmentInfo: string, problemDescription: string, history: { role: string, text: string }[]) {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are an expert industrial maintenance assistant for a food processing plant (like Tyson Foods). 
  Your goal is to help floor mechanics troubleshoot machines quickly and safely.
  
  Context:
  - Equipment: ${equipmentInfo}
  - User is a floor mechanic.
  - Safety is paramount. Always remind them of LOTO (Lock Out Tag Out) if applicable.
  - Be concise, technical, and helpful. Use industry terms.
  - If you don't know something, suggest checking the official manual or asking a Lead Technician.
  - You can also reference "Seasoned Technician Wisdom" which is shared knowledge in the plant.
  
  Format your response in simple markdown. Keep it short for easy reading on the floor.`;

  const contents = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: `Problem: ${problemDescription}` }]
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm having trouble connecting to my brain right now. Please try again or check the manual.";
  }
}
