# Legit landing page

Static site + two Netlify functions that write signups to EmailOctopus.

## Structure
- `index.html` — landing page + waitlist form (posts to /api/waitlist)
- `confirmed.html` — post-confirmation beta page (posts to /api/beta)
- `netlify/functions/waitlist.mjs` — creates PENDING contact, tag `waitlist`
- `netlify/functions/beta.mjs` — updates contact with beta fields, tag `beta`

## Required environment variable (set in Netlify)
- `EMAILOCTOPUS_API_KEY` — the EmailOctopus API key

Without that variable set, the forms return a 500.
