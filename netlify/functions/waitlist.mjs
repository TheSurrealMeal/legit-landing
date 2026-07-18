// Waitlist signup -> EmailOctopus (as PENDING, so double opt-in fires).
// The API key lives in a Netlify environment variable, never in the browser.

const LIST_ID = 'b5bde56e-82e0-11f1-ba13-b7ba0729686b';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const key = process.env.EMAILOCTOPUS_API_KEY;
  if (!key) return json({ error: 'server not configured' }, 500);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'invalid email' }, 400);
  }

  try {
    const res = await fetch(
      `https://emailoctopus.com/api/1.6/lists/${LIST_ID}/contacts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          email_address: email,
          tags: ['waitlist'],
          status: 'PENDING', // forces the double opt-in email
        }),
      }
    );

    const data = await res.json();

    // Already on the list? Treat as success — they don't need to know,
    // and a repeat signup shouldn't look like an error.
    if (
      !res.ok &&
      data.error &&
      data.error.code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS'
    ) {
      return json({ ok: true, already: true });
    }

    if (!res.ok) {
      console.error('EmailOctopus waitlist error:', JSON.stringify(data));
      return json({ error: 'provider error' }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('waitlist function failed:', err);
    return json({ error: 'server error' }, 500);
  }
};

export const config = { path: '/api/waitlist' };
