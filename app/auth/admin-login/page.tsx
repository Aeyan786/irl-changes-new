"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Mail,
  Lock,
  AlertCircle,
  Shield,
  ArrowLeft,
  EyeOff,
  Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

const adminLoginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

export default function AdminLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const form = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: AdminLoginFormData) {
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
        toast({
          variant: "destructive",
          title: "Login failed",
          description: authError.message,
        });
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setError("An unexpected error occurred. Please try again.");
        setIsLoading(false);
        return;
      }

      // Verify user is an admin
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (userError || !userData) {
        setError("Account not found. Please contact support.");
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      if (userData.role !== "admin") {
        setError("Access denied. This portal is for administrators only.");
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You do not have admin privileges.",
        });
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      toast({
        title: "Welcome, Admin!",
        description: "You have successfully logged in.",
      });

      router.push("/admin/dashboard");
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

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Back to regular login */}
      <div className="p-4 md:p-6">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/auth/login")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
      </div>

      {/* Main content - centered */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <Card className="w-full max-w-md shadow-lg border-primary/20">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl md:text-3xl font-semibold text-foreground">
              Admin Portal
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm md:text-base">
              Restricted access for IRL administrators
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
                  Admin Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@irl.com"
                    className="pl-10 h-11 "
                    {...form.register("email")}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-foreground font-medium"
                >
                  Password
                </Label>

                <div className="relative">
                  {/* Lock Icon */}
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                  {/* Password Input */}
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 h-11 "
                    {...form.register("password")}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />

                  {/* Eye Icon */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Error Message */}
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="accent"
                className=" w-full h-11 text-white font-medium text-base bg-linear-to-r from-[#FD3A10] via-[#ff6a3d] to-[#ff9a7a] cursor-pointer hover:shadow-gray-400 hover:transition-all duration-300 dark:hover:shadow-black"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Login
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex justify-center pt-2">
            <p className="text-xs text-muted-foreground text-center">
              This portal is for authorized administrators only.
              <br />
              Unauthorized access attempts will be logged.
            </p>
          </CardFooter>
        </Card>
      </div>

      {/* Security notice */}
      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Need help?{" "}
          <Link href="/support" className="text-primary hover:underline">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}
