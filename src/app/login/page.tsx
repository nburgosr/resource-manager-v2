"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="login">
      <h1>Iniciar sesión</h1>
      <p className="subtitle">Resource Manager · Consultoría IA &amp; Datos</p>

      <form action={formAction}>
        <input name="email" type="email" placeholder="Email" autoComplete="username" required />
        <input
          name="password"
          type="password"
          placeholder="Contraseña"
          autoComplete="current-password"
          required
        />
        <button type="submit" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </button>
        {error && <p className="err">{error}</p>}
      </form>

      <p className="hint">
        Demo — admin@example.com / admin123 · viewer@example.com / viewer123
      </p>
    </main>
  );
}
