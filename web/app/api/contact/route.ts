import { NextResponse } from "next/server";
import { sendContactNotificationEmail } from "@/lib/email/brevo";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, email, subject, message, organization, phone, honeypot } = body;

    // Protection anti-spam par champ piège (honeypot)
    if (honeypot) {
      return NextResponse.json(
        { message: "Demande refusée." },
        { status: 400 }
      );
    }

    // Validation des champs requis
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { message: "Veuillez fournir un nom complet valide (au moins 2 caractères)." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { message: "Veuillez fournir une adresse e-mail valide." },
        { status: 400 }
      );
    }

    if (!subject || typeof subject !== "string" || subject.trim().length < 2) {
      return NextResponse.json(
        { message: "Veuillez sélectionner un sujet pour votre message." },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length < 10) {
      return NextResponse.json(
        { message: "Votre message doit contenir au moins 10 caractères." },
        { status: 400 }
      );
    }

    // Envoi de l'e-mail à contact@narria.tech
    await sendContactNotificationEmail({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      organization: organization && typeof organization === "string" ? organization.trim() : undefined,
      phone: phone && typeof phone === "string" ? phone.trim() : undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Votre message a été transmis avec succès à contact@narria.tech. Nous vous répondrons sous 24h ouvrées.",
    });
  } catch (error: unknown) {
    console.error("Erreur lors de l'envoi du formulaire de contact:", error);
    return NextResponse.json(
      {
        message: "Une erreur est survenue lors de l'envoi de votre message. Veuillez réessayer ou écrire directement à contact@narria.tech.",
      },
      { status: 500 }
    );
  }
}
