"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/logo";

export default function HomePage() {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [ready, user, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Logo />
      <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
    </div>
  );
}
