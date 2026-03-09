export interface EmailDraft {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  from?: string;
  integration: 'google' | 'microsoft';
}

export function buildRFC2822(email: EmailDraft, from: string): string {
  const lines: string[] = [];
  lines.push(`From: ${from}`);
  lines.push(`To: ${email.to.join(', ')}`);
  if (email.cc && email.cc.length > 0) lines.push(`Cc: ${email.cc.join(', ')}`);
  if (email.bcc && email.bcc.length > 0) lines.push(`Bcc: ${email.bcc.join(', ')}`);
  lines.push(`Subject: ${email.subject}`);
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/html; charset=utf-8');
  lines.push('');
  lines.push(email.body);
  return lines.join('\r\n');
}

function toBase64url(str: string): string {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendGmailMessage(
  accessToken: string,
  email: EmailDraft,
  from: string
): Promise<{ messageId: string }> {
  const raw = toBase64url(buildRFC2822(email, from));
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${err}`);
  }
  const data = await res.json();
  return { messageId: data.id };
}

export async function createGmailDraft(
  accessToken: string,
  email: EmailDraft,
  from: string
): Promise<{ draftId: string }> {
  const raw = toBase64url(buildRFC2822(email, from));
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail draft failed: ${err}`);
  }
  const data = await res.json();
  return { draftId: data.id };
}
