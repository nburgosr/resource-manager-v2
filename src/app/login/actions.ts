"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

// Devuelve un mensaje de error o, si tiene éxito, redirige (lanza NEXT_REDIRECT).
export async function login(
  _prev: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/calendar",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Credenciales inválidas.";
    }
    throw error; // re-lanza el redirect de éxito y cualquier otro error
  }
}
