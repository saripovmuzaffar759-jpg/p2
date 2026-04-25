export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        // Твой Gemini API ключ
        const API_KEY = "AIzaSyD_D_ekxQMOnTpUIVO9746G8RRCxvyYAYc";
        
        console.log('📤 Отправка запроса к Gemini API:', message);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `Ты полезный AI ассистент. Отвечай на русском языке кратко и дружелюбно. Вопрос: ${message}`
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500
                }
            })
        });

        console.log('📥 Статус ответа Gemini:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API error:', errorData);
            return res.status(response.status).json({ 
                error: errorData.error?.message || `HTTP ${response.status}`
            });
        }

        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!reply) {
            console.error('No reply from Gemini:', data);
            return res.status(500).json({ error: 'No response from Gemini API' });
        }
        
        console.log('✅ Ответ получен:', reply.substring(0, 100));
        
        return res.status(200).json({ response: reply });
        
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: error.message });
    }
}
