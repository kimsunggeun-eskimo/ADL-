// Gemini API 프록시. API 키를 Netlify 환경변수(GEMINI_API_KEY)에만 보관하고
// 브라우저에는 절대 노출하지 않기 위한 서버리스 함수.
const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_PROMPT_LENGTH = 6000;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }) };
  }

  // 선택적 공유 시크릿 체크 (완전한 보안은 아니지만 무작위 스캔/악용 시도를 줄여줌)
  const appSecret = process.env.APP_SHARED_SECRET;
  if (appSecret && event.headers["x-app-secret"] !== appSecret) {
    return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const prompt = payload.prompt;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid prompt" }) };
  }

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 1024 }
        })
      }
    );
    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: data?.error?.message || "Gemini 요청 실패" }) };
    }
    const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
