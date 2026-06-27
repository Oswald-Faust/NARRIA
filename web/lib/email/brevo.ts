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
