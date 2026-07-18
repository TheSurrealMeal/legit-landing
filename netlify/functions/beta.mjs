// Beta application -> EmailOctopus. Adds the beta fields + "beta" tag to a
// contact who already confirmed on the waitlist. Because they've confirmed,
// we upsert them as SUBSCRIBED rather than triggering another opt-in.

import { createHash } from 'node:crypto';

const LIST_ID = 'b5bde56e-82e0-11f1-ba13-b7ba0729686b';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BROWSERS = ['Chrome','Edge','Brave','Arc','Opera','Vivaldi','Firefox','Safari','Other'];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// EmailOctopus identifies a contact by the MD5 of its lowercased email.
const contactIdFor = (email) =>
  createHash('md5').update(email.toLowerCase()).digest('hex');

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
  const firstName = String(body.first_name || '').trim().slice(0, 80);
  const browser = String(body.browser || '').trim();
  const watches = String(body.watches || '').trim().slice(0, 500);

  if (!EMAIL_RE.test(email)) return json({ error: 'invalid email' }, 400);
  if (!firstName) return json({ error: 'missing name' }, 400);
  if (!BROWSERS.includes(browser)) return json({ error: 'invalid browser' }, 400);
  if (!watches) return json({ error: 'missing watches' }, 400);

  const contactId = contactIdFor(email);

  const payload = {
    api_key: key,
    email_address: email,
    // Field keys are the field TAGS from EmailOctopus (capitalised).
    fields: {
      FirstName: firstName,
      Browser: browser,
      Watches: watches,
    },
    tags: ['beta'],
    status: 'SUBSCRIBED',
  };

  try {
    // PUT updates the existing contact (they confirmed on the waitlist).
    let res = await fetch(
      `https://emailoctopus.com/api/1.6/lists/${LIST_ID}/contacts/${contactId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    // If no existing contact (cleared storage, different email), create instead.
    if (res.status === 404) {
      res = await fetch(
        `https://emailoctopus.com/api/1.6/lists/${LIST_ID}/contacts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
    }

    const data = await res.json();

    if (!res.ok) {
      console.error('EmailOctopus beta error:', JSON.stringify(data));
      return json({ error: 'provider error' }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('beta function failed:', err);
    return json({ error: 'server error' }, 500);
  }
};

export const config = { path: '/api/beta' };
