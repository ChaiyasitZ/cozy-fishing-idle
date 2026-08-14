import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="text-center">
        <p className="text-5xl" aria-hidden>
          🎣
        </p>
        <h1 className="mt-2 text-2xl font-extrabold">Cozy Fishing Idle</h1>
        <p className="mt-1 text-sm text-ink-soft">
          เข้าสู่ระบบเพื่อเซฟขึ้นคลาวด์ เล่นข้ามเครื่อง และเล่นกับเพื่อน
        </p>
      </div>

      <LoginForm configured={isSupabaseConfigured()} />

      <Link href="/" className="text-center text-sm font-semibold text-water underline">
        กลับไปที่เกม
      </Link>
    </main>
  );
}
