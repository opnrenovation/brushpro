import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  text?: string;
}) {
  const { data, error } = await resend.emails.send({
    from: params.from || `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
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
