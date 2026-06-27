import { z } from "zod";

export const registerSchema = z
  .object({
    nomComplet: z.string().min(2, "Nom complet requis"),
    prenom: z.string().min(1, "Prénom requis"),
    email: z.string().email("Adresse e-mail invalide"),
    password: z.string().min(8, "8 caractères minimum"),
    confirmPassword: z.string(),
    cgu: z.literal(true, { message: "Vous devez accepter les CGU" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const adminCreateUserSchema = z
  .object({
    nomComplet: z.string().min(2, "Nom complet requis"),
    prenom: z.string().min(1, "Prénom requis"),
    email: z.string().email("Adresse e-mail invalide"),
    password: z
      .string()
      .min(8, "Minimum 8 caractères")
      .regex(/[A-Z]/, "Au moins une majuscule")
      .regex(/[0-9]/, "Au moins un chiffre"),
    role: z.enum(["user", "admin"]),
  });

export const otpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(5, "Code à 5 chiffres"),
});

export const personalInfoSchema = z.object({
  nomComplet: z.string().min(2, "Nom complet requis"),
  profession: z.string().min(2, "Profession requise"),
  narrativeSpecialty: z.string().min(2, "Spécialité requise"),
  country: z.string().min(2, "Pays requis"),
  langue: z.string().min(2, "Langue requise"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z
      .string()
      .min(8, "Minimum 8 caractères")
      .regex(/[A-Z]/, "Au moins une majuscule")
      .regex(/[0-9]/, "Au moins un chiffre")
      .regex(/[^A-Za-z0-9]/, "Au moins un caractère spécial"),
    confirmPassword: z.string().min(1, "Confirmation requise"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export const recoveryEmailSchema = z
  .object({
    recoveryEmail: z.string().email("Adresse e-mail invalide"),
    confirmRecoveryEmail: z.string().email("Adresse e-mail invalide"),
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  })
  .refine((d) => d.recoveryEmail === d.confirmRecoveryEmail, {
    message: "Les e-mails ne correspondent pas",
    path: ["confirmRecoveryEmail"],
  });

export const sms2faSchema = z.object({
  phoneNumber: z
    .string()
    .min(8, "Numéro requis")
    .regex(/^[+0-9()\s-]+$/, "Numéro invalide"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
