export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { mag, place } = req.body

  const apiKey = process.env.GEMINI_API_KEY
  const prompt = `A magnitude ${mag} earthquake occurred near ${place}. In simple, calm language: 1) briefly explain what this means, 2) give 2-3 basic safety precautions for people in that area. Keep it under 80 words total.`

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    )
    const data = await geminiRes.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate explanation.'
    res.status(200).json({ text })
  } catch (err) {
    res.status(500).json({ error: 'Gemini request failed' })
  }
}