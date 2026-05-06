// netlify/functions/analyze.js
// Отримує дані з дашборду → надсилає Claude → повертає аналіз

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY не налаштований в Netlify Environment Variables' })
    };
  }

  let platforms;
  try {
    platforms = JSON.parse(event.body).platforms;
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Невалідний JSON' }) };
  }

  const summary = platforms.map(p =>
    `• ${p.name}: рейтинг ${p.rating}/5.0, кількість відгуків: ${p.reviews}, оновлено: ${p.updated}`
  ).join('\n');

  const prompt = `Ти — аналітик репутації IT-компанії Wezom (аутсорсинг, Україна/Польща).
Проаналізуй дані з платформ відгуків і надай структурований аналіз.

ДАНІ:
${summary}

Відповідай ТІЛЬКИ у форматі JSON, без жодного тексту навколо, без markdown:
{
  "summary": "2-3 речення про загальну репутацію компанії на основі цих даних",
  "strengths": ["сильна сторона 1", "сильна сторона 2", "сильна сторона 3", "сильна сторона 4", "сильна сторона 5"],
  "improvements": ["зона покращення 1", "зона покращення 2", "зона покращення 3"],
  "trends": "1-2 речення про тренди репутації — де сильніша присутність, де слабша",
  "platforms_comparison": "1-2 речення про відмінності між платформами — де найкращий рейтинг, де найбільше відгуків"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API помилка: ${err}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return { statusCode: 200, headers, body: JSON.stringify(parsed) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
