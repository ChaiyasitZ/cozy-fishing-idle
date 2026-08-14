"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Panel } from "@/components/ui/primitives";
import { loadLocalState, markSaveForUpload } from "@/lib/save/local";
import { createClient } from "@/lib/supabase/client";

type Stage = "choose" | "code";

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!configured) {
    return (
      <Panel title="ยังไม่ได้ตั้งค่า Supabase">
        <p className="text-sm text-ink-soft">
          โปรเจกต์นี้ยังไม่มี <code>NEXT_PUBLIC_SUPABASE_URL</code> และ{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> — เล่นแบบ guest
          ได้ตามปกติ เซฟจะอยู่ในเครื่องนี้
        </p>
      </Panel>
    );
  }

  /** Guests keep their progress: stash the local save before the session changes. */
  const stashLocalSave = () => {
    const local = loadLocalState();
    if (local && local.stats.casts > 0) markSaveForUpload(local);
  };

  const oauth = async () => {
    const supabase = createClient();
    if (!supabase) return;
    stashLocalSave();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  const sendCode = async () => {
    const supabase = createClient();
    if (!supabase) return;
    stashLocalSave();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setStage("code");
    setMessage("ส่งรหัสแล้ว เช็คอีเมลของคุณ");
  };

  const verifyCode = async () => {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  };

  const anonymous = async () => {
    const supabase = createClient();
    if (!supabase) return;
    stashLocalSave();
    setBusy(true);
    const { error } = await supabase.auth.signInAnonymously();
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <Panel title="เข้าสู่ระบบ">
      <div className="flex flex-col gap-2">
        <Button tone="ghost" full disabled={busy} onClick={() => void oauth()}>
          <Image
            src="/icons/google.png"
            alt=""
            aria-hidden
            width={18}
            height={18}
            className="h-[18px] w-[18px]"
          />
          ต่อด้วย Google
        </Button>

        <div className="my-1 flex items-center gap-2 text-[11px] text-ink-soft">
          <span className="h-px flex-1 bg-card-edge" />
          หรือใช้อีเมล
          <span className="h-px flex-1 bg-card-edge" />
        </div>

        {stage === "choose" ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendCode();
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="rounded-xl border border-card-edge bg-card px-3 py-2 text-sm outline-none focus:border-water"
            />
            <Button type="submit" full disabled={busy || email.trim().length < 5}>
              ส่งรหัสเข้าอีเมล
            </Button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode();
            }}
          >
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="รหัส 6 หลัก"
              className="rounded-xl border border-card-edge bg-card px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-water"
            />
            <Button type="submit" full disabled={busy || code.trim().length < 6}>
              ยืนยันรหัส
            </Button>
            <Button tone="quiet" full onClick={() => setStage("choose")}>
              ใช้อีเมลอื่น
            </Button>
          </form>
        )}

        <Button tone="quiet" full disabled={busy} onClick={() => void anonymous()}>
          เล่นเลยไม่ต้องสมัคร (เซฟบนคลาวด์)
        </Button>

        {message && <p className="text-center text-[12px] text-coral">{message}</p>}
      </div>
    </Panel>
  );
}
