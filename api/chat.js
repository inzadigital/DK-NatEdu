// api/chat.js — Vercel Serverless Function
// Proxy seguro hacia la API de Anthropic.
// La API Key vive como variable de entorno ANTHROPIC_API_KEY en Vercel,
// nunca se expone al navegador del begirale.

export default async function handler(req, res) {
  // Solo aceptamos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server not configured: missing ANTHROPIC_API_KEY environment variable'
    });
  }

  // Leer body (Vercel lo parsea automáticamente si Content-Type es JSON)
  const body = req.body || {};
  const messages = body.messages;
  const system = body.system || '';

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Basic validation to keep things tight
  const cleanMessages = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 10000) }));

  if (cleanMessages.length === 0) {
    return res.status(400).json({ error: 'no valid messages' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: system,
        messages: cleanMessages
      })
    });

    const data = await r.json();

    if (!r.ok || data.error) {
      console.error('Anthropic API error:', data);
      return res.status(r.status || 500).json({
        error: (data.error && data.error.message) || 'API error'
      });
    }

    // Extraer el texto de la respuesta
    let text = '';
    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text' && block.text) text += block.text;
      }
    }

    return res.status(200).json({ text: text || '(erantzun hutsa)' });

  } catch (e) {
    console.error('Chat proxy error:', e);
    return res.status(500).json({ error: 'Server error: ' + (e.message || 'unknown') });
  }
}
