"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Users,
  Trophy,
  Heart,
  UserCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { signUp } from "@/app/actions/auth";
import {
  US_STATES,
  GENDER_OPTIONS,
  ZIP_REGEX,
  passwordSchema,
  emailSchema,
} from "@/lib/validations";
import Image from "next/image";

const signUpFormSchema = z
  .object({
    role: z.enum(["runner", "manager"], {
      required_error: "Please select a role",
    }),
    firstName: z.string().min(1, "First name is required").max(50, "First name is too long"),
    lastName: z.string().min(1, "Last name is required").max(50, "Last name is too long"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    street: z.string().min(1, "Street address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "Please select a state"),
    zipCode: z.string().regex(ZIP_REGEX, "Please enter a valid ZIP code (e.g., 12345 or 12345-6789)"),
    age: z.coerce.number().min(18, "You must be at least 18 years old").max(120, "Please enter a valid age"),
    gender: z.enum(["male", "female"], { required_error: "Please select a gender" }),
    pastAchievements: z.string().optional(),
    disabilities: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignUpFormData = z.infer<typeof signUpFormSchema>;

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"runner" | "manager" | null>(null);
  const [changeInfoSection, setChangeInfoSection] = useState<"personal" | "address" | "security" | "optional" | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      role: undefined,
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      age: undefined,
      gender: undefined,
      pastAchievements: "",
      disabilities: "",
    },
  });

  // If coming from invite link, force runner role
  useEffect(() => {
    if (inviteToken) {
      setSelectedRole("runner");
      setChangeInfoSection("personal");
      form.setValue("role", "runner");
    }
  }, [inviteToken, form]);

  const handleRoleChange = (value: "runner" | "manager") => {
    setSelectedRole(value);
    setChangeInfoSection("personal");
    form.setValue("role", value);
    form.clearErrors();
  };

  async function onSubmit(data: SignUpFormData) {
    setIsLoading(true);
    setError(null);

    const result = await signUp({
      email: data.email,
      password: data.password,
      role: data.role,
      firstName: data.firstName,
      lastName: data.lastName,
      street: data.street,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      age: data.age,
      gender: data.gender,
      pastAchievements: data.role === "runner" ? data.pastAchievements : undefined,
      disabilities: data.role === "runner" ? data.disabilities : undefined,
    });

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    // If coming from invite, redirect back to invite page after login
    if (inviteToken) {
      router.push(`/auth/login?returnUrl=${encodeURIComponent(`/invite/${inviteToken}`)}&verified=pending&invite=true`);
    } else {
      router.push("/auth/login?verified=pending");
    }
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-white">
      {/* Left Box */}
      <div className="relative hidden m-2 rounded-xl overflow-hidden lg:block w-1/2 min-h-full shadow-[inset_1px_1px_10px_rgba(0,0,0,0.4)]">
        <Image src="/relay.jpeg" alt="background" fill className="object-cover" />
        <div className="absolute inset-0 bg-linear-to-t from-black via-gray-700/30 to-gray-700/10 flex flex-col justify-end items-start text-left p-6">
          <Image
            src={"/black_red_irl_fav_icon__1_-removebg-preview.png"}
            width={50}
            height={50}
            alt="irl_logo"
            className="absolute top-6 left-6 block dark:hidden"
          />
          <p className="text-white text-xs font-semibold mb-3 bg-white/20 backdrop-blur-xs rounded-lg px-3 py-1 inline-block">
            Where the finish line is just the beginning
          </p>
          <span className="font-bold text-white capitalize mb-5">
            Become part of the world's first relay running league. <br /> Run together. Win together.
          </span>
        </div>
      </div>

      {/* Right Box */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Card className="border-none shadow-none">
            <CardHeader className="text-left mb-4">
              <CardTitle className="text-2xl md:text-3xl font-semibold text-foreground mt-5">
                Create an account
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {inviteToken
                  ? "Create a runner account to join the team"
                  : "Join the Infinite Running League today"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {inviteToken && (
                <Alert className="mb-6 bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    You're signing up to accept a team invitation. You'll be redirected back after verifying your email.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Role Selection — hidden if coming from invite */}
                {!selectedRole && !inviteToken && (
                  <div className="space-y-2">
                    <Label htmlFor="role" className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Select Your Role <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={selectedRole || undefined}
                      onValueChange={(value: "runner" | "manager") => handleRoleChange(value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="role" className="w-full cursor-pointer">
                        <SelectValue placeholder="Choose your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="runner" className="cursor-pointer">
                          <div className="flex items-center  gap-2">
                            <UserCircle className="h-4 w-4 hover:text-white" />
                            <span>Runner</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="manager" className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 hover:text-white" />
                            <span>Manager</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.role && (
                      <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>
                    )}
                  </div>
                )}

                {selectedRole && (
                  <>
                    {/* Personal Information */}
                    {changeInfoSection === "personal" && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">
                          Personal Information
                        </h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                            <Input id="firstName" placeholder="John" className="pl-5" {...form.register("firstName")} disabled={isLoading} />
                            {form.formState.errors.firstName && <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                            <Input id="lastName" placeholder="Doe" className="pl-5" {...form.register("lastName")} disabled={isLoading} />
                            {form.formState.errors.lastName && <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                          <Input id="email" type="email" placeholder="you@example.com" className="pl-5" {...form.register("email")} disabled={isLoading} />
                          {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="age">Age <span className="text-destructive">*</span></Label>
                            <Input id="age" type="number" min={18} max={120} placeholder="25" className="pl-5" {...form.register("age")} disabled={isLoading} />
                            {form.formState.errors.age && <p className="text-sm text-destructive">{form.formState.errors.age.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="gender">Gender <span className="text-destructive">*</span></Label>
                            <Select onValueChange={(value: "male" | "female") => form.setValue("gender", value)} disabled={isLoading}>
                              <SelectTrigger id="gender" className="w-full">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              <SelectContent>
                                {GENDER_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {form.formState.errors.gender && <p className="text-sm text-destructive">{form.formState.errors.gender.message}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-8">
                          {!inviteToken && (
                            <Button type="button" variant="outline" onClick={() => { setSelectedRole(null); setChangeInfoSection(null); form.reset(); }} className="h-11 bg-white font-medium text-base cursor-pointer">
                              <ChevronLeft /> Back
                            </Button>
                          )}
                          <Button type="button" onClick={async () => { const valid = await form.trigger(["firstName", "lastName", "email", "age", "gender"]); if (valid) setChangeInfoSection("address"); }} className="w-76 h-11 text-white font-medium text-base hover:bg-red-700 bg-red-600 cursor-pointer">
                            Next <ChevronRight />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Address */}
                    {changeInfoSection === "address" && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">Address</h3>
                        <div className="space-y-2">
                          <Label htmlFor="street">Street Address <span className="text-destructive">*</span></Label>
                          <Input id="street" placeholder="123 Main St" className="pl-5" {...form.register("street")} disabled={isLoading} />
                          {form.formState.errors.street && <p className="text-sm text-destructive">{form.formState.errors.street.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                          <Input id="city" placeholder="New York" className="pl-5" {...form.register("city")} disabled={isLoading} />
                          {form.formState.errors.city && <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>}
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="state">State <span className="text-destructive">*</span></Label>
                            <Select onValueChange={(value) => form.setValue("state", value)} disabled={isLoading}>
                              <SelectTrigger id="state"><SelectValue placeholder="Select state" /></SelectTrigger>
                              <SelectContent className="max-h-60">
                                {US_STATES.map((state) => <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {form.formState.errors.state && <p className="text-sm text-destructive">{form.formState.errors.state.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="zipCode">ZIP Code <span className="text-destructive">*</span></Label>
                            <Input id="zipCode" placeholder="12345" className="pl-5" {...form.register("zipCode")} disabled={isLoading} />
                            {form.formState.errors.zipCode && <p className="text-sm text-destructive">{form.formState.errors.zipCode.message}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-8">
                          <Button type="button" variant="outline" onClick={() => setChangeInfoSection("personal")} className="h-11 bg-white text-foreground font-medium text-base cursor-pointer">
                            <ChevronLeft /> Back
                          </Button>
                          <Button type="button" onClick={async () => { const valid = await form.trigger(["street", "city", "state", "zipCode"]); if (valid) setChangeInfoSection(selectedRole === "runner" ? "optional" : "security"); }} className="w-76 h-11 text-white font-medium text-base bg-red-600 cursor-pointer hover:bg-red-700">
                            Next <ChevronRight />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Runner optional fields */}
                    {selectedRole === "runner" && changeInfoSection === "optional" && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">Runner Profile (Optional)</h3>
                        <div className="space-y-2">
                          <Label htmlFor="pastAchievements" className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-muted-foreground" /> Past Achievements
                          </Label>
                          <Textarea id="pastAchievements" placeholder="List your running achievements, personal records, races completed, etc." className="min-h-24 resize-y" {...form.register("pastAchievements")} disabled={isLoading} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="disabilities" className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-muted-foreground" /> Disabilities or Accommodations
                          </Label>
                          <Textarea id="disabilities" placeholder="Let us know if you need any accommodations or have any conditions we should be aware of." className="min-h-24 resize-y" {...form.register("disabilities")} disabled={isLoading} />
                        </div>
                        <div className="flex items-center gap-2 mt-8">
                          <Button variant="outline" onClick={() => setChangeInfoSection("address")} className="h-11 text-foreground bg-white font-medium text-base cursor-pointer">
                            <ChevronLeft /> Back
                          </Button>
                          <Button onClick={() => setChangeInfoSection("security")} className="w-76 h-11 text-white font-medium text-base bg-red-600 cursor-pointer hover:bg-red-700">
                            Next <ChevronRight />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Security */}
                    {changeInfoSection === "security" && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">Security</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                            <Input id="password" type="password" placeholder="Create a password" className="pl-5" {...form.register("password")} disabled={isLoading} />
                            {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password <span className="text-destructive">*</span></Label>
                            <Input id="confirmPassword" type="password" placeholder="Confirm your password" className="pl-5" {...form.register("confirmPassword")} disabled={isLoading} />
                            {form.formState.errors.confirmPassword && <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Must be at least 8 characters with uppercase, lowercase, and number</p>
                        <div className="flex items-center gap-2 mt-8">
                          <Button type="button" variant="outline" onClick={() => setChangeInfoSection(selectedRole === "runner" ? "optional" : "address")} className="h-11 text-foreground bg-white font-medium text-base cursor-pointer">
                            <ChevronLeft /> Back
                          </Button>
                          <Button type="submit" className="w-72 h-11 cursor-pointer hover:shadow-xl text-white bg-red-600 hover:bg-red-700" disabled={isLoading}>
                            {isLoading ? "Signing up..." : "Signup"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </form>
            </CardContent>
            <CardFooter className="flex justify-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href={inviteToken ? `/auth/login?returnUrl=${encodeURIComponent(`/invite/${inviteToken}`)}&invite=true` : "/auth/login"}
                  className="text-black dark:text-muted-foreground hover:underline font-medium transition-colors"
                >
                  Login
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
