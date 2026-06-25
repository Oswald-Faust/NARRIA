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

export const otpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(5, "Code à 5 chiffres"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
