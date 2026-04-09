"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, AlertCircle, Shield, EyeOff, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(["runner", "manager"], {
    required_error: "Please select your role",
  }),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const isVerificationPending = searchParams.get("verified") === "pending";
  const returnUrl = searchParams.get("returnUrl");

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      role: undefined,
    },
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

      if (authError) {
        setError(authError.message);
        toast({ title: "Login failed", description: authError.message });
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setError("An unexpected error occurred. Please try again.");
        setIsLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (userError || !userData) {
        toast({
          title: "Welcome!",
          description: "You have successfully logged in.",
        });
        const redirectPath =
          returnUrl ||
          (data.role === "runner" ? "/runner/dashboard" : "/manager/dashboard");
        router.push(redirectPath);
        router.refresh();
        return;
      }

      if (
        userData.role !== data.role &&
        userData.role !== "admin" &&
        userData.role !== "assistant_manager"
      ) {
        setError(
          `Your account is registered as a ${userData.role}. Please select the correct role.`,
        );
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });

      if (returnUrl) {
        router.push(returnUrl);
        router.refresh();
        return;
      }

      const redirectPath =
        userData.role === "runner"
          ? "/runner/dashboard"
          : userData.role === "manager"
            ? "/manager/dashboard"
            : userData.role === "assistant_manager"
              ? "/portal-select"
              : "/admin/dashboard";

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
      setIsLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{ colorScheme: "light" }}
    >
      {/* ── Full page video background ── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/running-poster.jpg"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/running-background.mp4" type="video/mp4" />
      </video>

      {/* Fallback image if video fails */}
      <div className="absolute inset-0 -z-10 bg-gray-950" />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/55" />

      {/* ── IRL Logo top left ── */}
      <div className="absolute top-6 left-6 z-20">
        <Image
          src="/white_red_irl_fav_icon__1_-removebg-preview.png"
          width={44}
          height={44}
          alt="IRL Logo"
        />
      </div>

      {/* ── Bottom left tagline (desktop only) ── */}
      <div className="absolute bottom-8 left-8 z-20 hidden lg:block max-w-sm">
        <div className="w-8 h-0.5 bg-red-500 mb-3" />
        <p className="text-white font-bold text-2xl leading-tight mb-3">
          Where the finish line is
          <br />
          just the beginning.
        </p>
        <p className="text-white/55 text-sm leading-relaxed tracking-wide uppercase font-medium">
          Infinite Running League
        </p>
      </div>

      {/* ── Glassmorphism form — centered ── */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl px-8 py-10">
            {/* Header */}
            <div className="mb-7">
              <h1 className="text-3xl font-bold text-white">
                Welcome to <span className="text-red-500">IRL</span>
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Sign in to your Infinite Running League account
              </p>
            </div>

            {/* Alerts */}
            {isVerificationPending && (
              <Alert className="mb-5 bg-white/10 border-white/20">
                <Mail className="h-4 w-4 text-white" />
                <AlertDescription className="text-white/90">
                  Account created! Please verify your email before logging in.
                </AlertDescription>
              </Alert>
            )}

            {returnUrl?.startsWith("/invite/") && (
              <Alert className="mb-5 bg-white/10 border-white/20">
                <Mail className="h-4 w-4 text-white" />
                <AlertDescription className="text-white/90">
                  Please sign in with your runner account to accept the team
                  invitation.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert className="mb-5 bg-red-500/20 border-red-400/40">
                <AlertCircle className="h-4 w-4 text-red-300" />
                <AlertDescription className="text-red-200">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Role */}
              <div className="space-y-1.5">
                <Label className="text-white/80 text-sm">I am</Label>
                <Select
                  onValueChange={(value: "runner" | "manager") =>
                    form.setValue("role", value)
                  }
                  disabled={isLoading}
                  defaultValue={
                    returnUrl?.startsWith("/invite/") ? "runner" : undefined
                  }
                >
                  <SelectTrigger className="h-11 w-full cursor-pointer bg-white/10 border-white/20 text-white data-[placeholder]:text-white/40 focus:ring-white/30">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem className="cursor-pointer" value="runner">Runner</SelectItem>
                    <SelectItem className="cursor-pointer" value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>{" "}
                {form.formState.errors.role && (
                  <p className="text-red-300 text-xs">
                    {form.formState.errors.role.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-white/80 text-sm">Email</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30"
                  {...form.register("email")}
                  disabled={isLoading}
                />
                {form.formState.errors.email && (
                  <p className="text-red-300 text-xs">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-white/80 text-sm">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-red-400 hover:text-red-300 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30"
                    {...form.register("password")}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="text-white/50 h-4 w-4" />
                    ) : (
                      <Eye className="text-white/50 h-4 w-4" />
                    )}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-red-300 text-xs">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 cursor-pointer bg-red-600 hover:bg-red-700 hover:shadow-xl text-white font-semibold mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>

            {/* Sign up link */}
            <p className="text-center text-sm text-white/50 mt-6">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="text-white/80 font-medium hover:text-white hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ── Admin Login ── */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-20">
        <Button
          variant="outline"
          size="sm"
          className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/70 cursor-pointer shadow-md"
          onClick={() => router.push("/auth/admin-login")}
        >
          <Shield className="mr-2 h-4 w-4" />
          Admin Login
        </Button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
