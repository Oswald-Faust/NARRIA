import nodemailer from "nodemailer";

type MailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function smtpConfig() {
  const host = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const port = Number(process.env.BREVO_SMTP_PORT || 587);
  const user = process.env.BREVO_SMTP_LOGIN;
  const pass = process.env.BREVO_SMTP_PASSWORD;
  const from = process.env.NARRIA_SENDER_EMAIL || "noreply@narria.tech";

  if (!user || !pass) {
    throw new Error("BREVO_SMTP_LOGIN ou BREVO_SMTP_PASSWORD manquant.");
  }

  return { host, port, user, pass, from };
}

export async function sendMail({ to, subject, text, html }: MailOptions) {
  const { host, port, user, pass, from } = smtpConfig();
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

export async function sendOtpEmail(email: string, code: string) {
  const subject = "Votre code de verification NARR'IA";
  const text = [
    "Bonjour,",
    "",
    `Votre code de verification NARR'IA est : ${code}`,
    "",
    "Ce code expire dans 10 minutes.",
    "",
    "Si vous n'etes pas a l'origine de cette demande, vous pouvez ignorer ce message.",
    "",
    "L'equipe NARR'IA",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #16111f;">
      <p>Bonjour,</p>
      <p>Votre code de verification NARR'IA est :</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${code}</p>
      <p>Ce code expire dans 10 minutes.</p>
      <p>Si vous n'etes pas a l'origine de cette demande, vous pouvez ignorer ce message.</p>
      <p>L'equipe NARR'IA</p>
    </div>
  `;

  await sendMail({ to: email, subject, text, html });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ROLE_LABELS: Record<string, string> = {
  "co-admin": "Co-administrateur",
  collaborateur: "Collaborateur",
  lecteur: "Lecteur",
};

/**
 * E-mail d'invitation à un projet, aux couleurs de la marque, avec un bouton
 * « Rejoindre le projet » pointant vers un lien d'acceptation nominatif (`joinUrl`).
 */
/** Construit le sujet/texte/HTML de l'e-mail d'invitation (pur, testable sans SMTP). */
export function buildProjectInvitationEmail(
  projectName: string,
  inviterName: string,
  joinUrl: string,
  role?: string,
): { subject: string; text: string; html: string } {
  const roleLabel = role ? ROLE_LABELS[role] ?? role : null;
  const subject = `${inviterName} vous invite à rejoindre le projet « ${projectName} » sur NARR'IA`;

  const text = [
    "Bonjour,",
    "",
    `${inviterName} vous invite à rejoindre le projet « ${projectName} » sur NARR'IA${roleLabel ? ` en tant que ${roleLabel}` : ""}.`,
    "",
    "Pour accepter l'invitation, ouvrez ce lien :",
    joinUrl,
    "",
    "Si vous n'avez pas encore de compte NARR'IA, créez-en un avec cette adresse e-mail : vous serez ensuite redirigé vers l'invitation.",
    "",
    "L'équipe NARR'IA",
  ].join("\n");

  const safeProject = escapeHtml(projectName);
  const safeInviter = escapeHtml(inviterName);
  const safeUrl = escapeHtml(joinUrl);

  const html = `
  <div style="margin:0;padding:0;background:#f4eff7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4eff7;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(132,59,144,0.10);font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td style="background:linear-gradient(135deg,#843b90,#da3861);padding:28px 32px;">
              <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.02em;">NARR'IA</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#2a2233;line-height:1.6;">
              <p style="margin:0 0 16px;font-size:16px;">Bonjour,</p>
              <p style="margin:0 0 16px;font-size:16px;">
                <strong>${safeInviter}</strong> vous invite à rejoindre le projet
                « <strong style="color:#843b90;">${safeProject}</strong> » sur NARR'IA${roleLabel ? ` en tant que <strong>${escapeHtml(roleLabel)}</strong>` : ""}.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;">
                <tr><td style="border-radius:999px;background:linear-gradient(135deg,#843b90,#da3861);">
                  <a href="${safeUrl}" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;">Rejoindre le projet →</a>
                </td></tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#6c6c6c;">
                Si vous n'avez pas encore de compte NARR'IA, créez-en un avec cette adresse e-mail : vous serez ensuite redirigé vers l'invitation.
              </p>
              <p style="margin:16px 0 0;font-size:12px;color:#9a90a3;word-break:break-all;">
                Le bouton ne fonctionne pas ? Copiez ce lien : <br/>
                <a href="${safeUrl}" style="color:#843b90;">${safeUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #ece2f0;color:#9a90a3;font-size:12px;">
              NARR'IA · narria.tech — Narratologie computationnelle
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </div>
  `;

  return { subject, text, html };
}

export async function sendProjectInvitationEmail(
  email: string,
  projectName: string,
  inviterName: string,
  joinUrl: string,
  role?: string,
) {
  const { subject, text, html } = buildProjectInvitationEmail(projectName, inviterName, joinUrl, role);
  await sendMail({ to: email, subject, text, html });
}

export type ContactFormData = {
  name: string;
  email: string;
  subject: string;
  message: string;
  organization?: string;
  phone?: string;
};

export function buildContactEmail(data: ContactFormData): { subject: string; text: string; html: string } {
  const mailSubject = `[NARR'IA Contact] ${data.subject} — ${data.name}`;

  const textLines = [
    "Nouveau message reçu depuis le formulaire de contact de NARR'IA :",
    "",
    `Nom : ${data.name}`,
    `Email : ${data.email}`,
    data.organization ? `Organisation : ${data.organization}` : null,
    data.phone ? `Téléphone : ${data.phone}` : null,
    `Sujet : ${data.subject}`,
    "",
    "Message :",
    data.message,
  ].filter((line): line is string => line !== null);

  const text = textLines.join("\n");

  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  const safeSubject = escapeHtml(data.subject);
  const safeMessage = escapeHtml(data.message).replace(/\n/g, "<br/>");
  const safeOrg = data.organization ? escapeHtml(data.organization) : null;
  const safePhone = data.phone ? escapeHtml(data.phone) : null;

  const html = `
  <div style="margin:0;padding:0;background:#f4eff7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4eff7;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(132,59,144,0.10);font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td style="background:linear-gradient(135deg,#843b90,#da3861);padding:28px 32px;">
              <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.02em;">NARR'IA</span>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Formulaire de contact web</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#2a2233;line-height:1.6;">
              <p style="margin:0 0 20px;font-size:16px;font-weight:700;">Nouveau message de contact reçu :</p>
              <table role="presentation" width="100%" style="margin-bottom:20px;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:6px 0;color:#6c6c6c;width:120px;vertical-align:top;">Nom :</td><td style="padding:6px 0;font-weight:600;color:#16111f;">${safeName}</td></tr>
                <tr><td style="padding:6px 0;color:#6c6c6c;vertical-align:top;">Email :</td><td style="padding:6px 0;font-weight:600;"><a href="mailto:${safeEmail}" style="color:#843b90;">${safeEmail}</a></td></tr>
                ${safeOrg ? `<tr><td style="padding:6px 0;color:#6c6c6c;vertical-align:top;">Organisation :</td><td style="padding:6px 0;color:#16111f;">${safeOrg}</td></tr>` : ""}
                ${safePhone ? `<tr><td style="padding:6px 0;color:#6c6c6c;vertical-align:top;">Téléphone :</td><td style="padding:6px 0;color:#16111f;">${safePhone}</td></tr>` : ""}
                <tr><td style="padding:6px 0;color:#6c6c6c;vertical-align:top;">Sujet :</td><td style="padding:6px 0;font-weight:700;color:#da3861;">${safeSubject}</td></tr>
              </table>
              <div style="background:#f9f6fc;border-left:4px solid #843b90;padding:18px;border-radius:10px;margin-top:16px;">
                <p style="margin:0;font-size:14px;color:#221338;line-height:1.7;">${safeMessage}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #ece2f0;color:#9a90a3;font-size:12px;">
              NARR'IA · narria.tech — Plateforme de Narratologie Computationnelle
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </div>
  `;

  return { subject: mailSubject, text, html };
}

export async function sendContactNotificationEmail(data: ContactFormData) {
  const { subject, text, html } = buildContactEmail(data);
  const targetEmail = "contact@narria.tech";
  await sendMail({ to: targetEmail, subject, text, html });
}

