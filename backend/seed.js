// ============================================================================
// USUARIOS ESTABLECIDOS (cuentas de prueba)
// ============================================================================
// Al encender el backend se crean estas dos cuentas si todavía no existen.
// - No se vuelven a crear ni se les cambia la contraseña si ya existen.
// - Para desactivarlas (por ejemplo en producción): SEED_DEMO_USERS=false
// - Para cambiar los datos, edita la lista de abajo ANTES de la primera vez
//   (o borra la cuenta en la base de datos y reinicia).
// ============================================================================
import { createUser, findUserByEmail } from "./authCore.js";

export const DEMO_USERS = [
  { name: "Docente Demo", email: "docente@yachayplay.com", password: "Docente123", role: "docente" },
  { name: "Estudiante Demo", email: "estudiante@yachayplay.com", password: "Estudiante123", role: "estudiante" },
];

// En producción quedan APAGADAS salvo que pongas SEED_DEMO_USERS=true (las claves son públicas).
export const demoEnabled = () =>
  process.env.NODE_ENV === "production" ? process.env.SEED_DEMO_USERS === "true" : process.env.SEED_DEMO_USERS !== "false";

// Devuelve los correos de las cuentas que se acaban de crear.
export async function seedDemoUsers() {
  if (!demoEnabled()) return [];
  const creados = [];
  for (const u of DEMO_USERS) {
    if (!(await findUserByEmail(u.email))) {
      await createUser(u);
      creados.push(u.email);
    }
  }
  return creados;
}
