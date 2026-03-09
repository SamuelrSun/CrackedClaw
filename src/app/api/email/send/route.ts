import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendGmailMessage, type EmailDraft } from '@/lib/email/gmail-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let body: EmailDraft;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.to?.length || !body.subject || !body.body || !body.integration) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('access_token, account_name')
    .eq('user_id', user.id)
    .eq('provider', body.integration)
    .eq('status', 'connected')
    .single();

  if (!integration?.access_token) {
    return NextResponse.json({ error: `${body.integration} not connected` }, { status: 403 });
  }

  try {
    if (body.integration === 'google') {
      const from = integration.account_name || user.email || '';
      const result = await sendGmailMessage(integration.access_token, body, from);
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else if (body.integration === 'microsoft') {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: body.subject,
            body: { contentType: 'HTML', content: body.body },
            toRecipients: body.to.map(addr => ({ emailAddress: { address: addr } })),
            ccRecipients: (body.cc || []).map(addr => ({ emailAddress: { address: addr } })),
            bccRecipients: (body.bcc || []).map(addr => ({ emailAddress: { address: addr } })),
          },
          saveToSentItems: true,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Microsoft send failed: ${err}` }, { status: 502 });
      }
      return NextResponse.json({ success: true, messageId: null });
    } else {
      return NextResponse.json({ error: 'Unsupported integration' }, { status: 400 });
    }
  } catch (err) {
    console.error('Email send error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
