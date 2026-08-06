import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

// Recipients copied on customer-facing email. Haruko and Danny are BCC'd
// directly because Hotmail/Live silently drop mail forwarded from the
// info@ mailbox. Do NOT use for credential emails (invites, password
// resets) or campaigns. Override with COMPANY_BCC_EMAIL (comma-separated).
export const COMPANY_BCC = (
  process.env.COMPANY_BCC_EMAIL || 'info@opnrenovation.com,harunakata@hotmail.com,odperez@live.com'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  text?: string;
  bcc?: string | string[];
  tags?: Array<{ name: string; value: string }>;
  attachments?: Array<{ filename: string; content: Buffer }>;
}) {
  const { data, error } = await resend.emails.send({
    from: params.from || `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
    bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : undefined,
    tags: params.tags,
    attachments: params.attachments?.map(a => ({ filename: a.filename, content: a.content })),
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return data;
}

export async function upsertResendContact(contact: {
  email: string;
  first_name?: string;
  last_name?: string;
  unsubscribed?: boolean;
}) {
  const audienceId = process.env.RESEND_AUDIENCE_ID!;
  const { error } = await resend.contacts.create({
    audienceId,
    email: contact.email,
    firstName: contact.first_name,
    lastName: contact.last_name,
    unsubscribed: contact.unsubscribed ?? false,
  });
  if (error) throw new Error(`Resend contact upsert failed: ${error.message}`);
}
