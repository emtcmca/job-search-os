# Longer-Term Workflow List

## Contact Form Buildout

Add a homepage contact form while keeping the current direct email CTAs in place.

Recommended direction:

- Keep the site static-first.
- Add a polished contact section near the homepage closing CTA.
- Submit form data to a small Vercel Function at `/api/contact`.
- Send inquiries to `emtcmca@gmail.com` through Resend or a comparable email provider.
- Include basic validation, message length limits, and a honeypot field for spam reduction.
- Revisit once a production sender domain or email provider setup is ready.
