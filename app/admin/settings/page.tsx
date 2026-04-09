"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { updateProfile, changePassword, changeEmail } from "@/app/actions/auth"
import { US_STATES, GENDER_OPTIONS } from "@/lib/validations"
import {
  User,
  Lock,
  Mail,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  CheckCircle,
} from "lucide-react"

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  age: z.coerce.number().min(18, "Must be at least 18"),
  gender: z.enum(["male", "female", "other"]),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

const emailSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
  confirmEmail: z.string(),
}).refine((data) => data.newEmail === data.confirmEmail, {
  message: "Emails don't match",
  path: ["confirmEmail"],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>
type EmailFormData = z.infer<typeof emailSchema>

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [currentEmail, setCurrentEmail] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      age: 18,
      gender: "male",
    },
  })

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  // Email form
  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      newEmail: "",
      confirmEmail: "",
    },
  })

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      setCurrentEmail(user.email || "")
      
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profile) {
        // Address is stored as JSONB object
        const address = profile.address as { street?: string; city?: string; state?: string; zipCode?: string } | null
        profileForm.reset({
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          street: address?.street || "",
          city: address?.city || "",
          state: address?.state || "",
          zipCode: address?.zipCode || "",
          age: profile.age || 18,
          gender: profile.gender || "male",
        })
      }
    }

    setLoading(false)
  }

  const onProfileSubmit = async (data: ProfileFormData) => {
    const result = await updateProfile(data)

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      })
    }
  }

  const onPasswordSubmit = async (data: PasswordFormData) => {
    const result = await changePassword(data.currentPassword, data.newPassword)

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully.",
      })
      passwordForm.reset()
    }
  }

  const onEmailSubmit = async (data: EmailFormData) => {
    const result = await changeEmail(data.newEmail)

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Verification Email Sent",
        description: "Verification email sent to new address. Please confirm before logging in again.",
      })
      emailForm.reset()
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-accent" />
          <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your admin account and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Password</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                {/* Name */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      {...profileForm.register("firstName")}
                      aria-invalid={!!profileForm.formState.errors.firstName}
                    />
                    {profileForm.formState.errors.firstName && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      {...profileForm.register("lastName")}
                      aria-invalid={!!profileForm.formState.errors.lastName}
                    />
                    {profileForm.formState.errors.lastName && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="street">Street Address</Label>
                  <Input
                    id="street"
                    {...profileForm.register("street")}
                    aria-invalid={!!profileForm.formState.errors.street}
                  />
                  {profileForm.formState.errors.street && (
                    <p className="text-sm text-destructive">
                      {profileForm.formState.errors.street.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      {...profileForm.register("city")}
                      aria-invalid={!!profileForm.formState.errors.city}
                    />
                    {profileForm.formState.errors.city && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.city.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={profileForm.watch("state")}
                      onValueChange={(value) => profileForm.setValue("state", value)}
                    >
                      <SelectTrigger aria-invalid={!!profileForm.formState.errors.state}>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {profileForm.formState.errors.state && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.state.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      {...profileForm.register("zipCode")}
                      aria-invalid={!!profileForm.formState.errors.zipCode}
                    />
                    {profileForm.formState.errors.zipCode && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.zipCode.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Age and Gender */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      min={18}
                      {...profileForm.register("age")}
                      aria-invalid={!!profileForm.formState.errors.age}
                    />
                    {profileForm.formState.errors.age && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.age.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={profileForm.watch("gender")}
                      onValueChange={(value) => profileForm.setValue("gender", value as "male" | "female" | "other")}
                    >
                      <SelectTrigger aria-invalid={!!profileForm.formState.errors.gender}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {profileForm.formState.errors.gender && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.gender.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button type="submit" className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer" disabled={profileForm.formState.isSubmitting}>
                  {profileForm.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      {...passwordForm.register("currentPassword")}
                      aria-invalid={!!passwordForm.formState.errors.currentPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      {...passwordForm.register("newPassword")}
                      aria-invalid={!!passwordForm.formState.errors.newPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters with uppercase, lowercase, and number
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      {...passwordForm.register("confirmPassword")}
                      aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer" disabled={passwordForm.formState.isSubmitting}>
                  {passwordForm.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Change Email</CardTitle>
              <CardDescription>
                Update your email address. You will need to verify the new email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-6">
                <div className="rounded-lg bg-muted p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Current email: <strong>{currentEmail}</strong></span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newEmail">New Email Address</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    {...emailForm.register("newEmail")}
                    aria-invalid={!!emailForm.formState.errors.newEmail}
                  />
                  {emailForm.formState.errors.newEmail && (
                    <p className="text-sm text-destructive">
                      {emailForm.formState.errors.newEmail.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmEmail">Confirm New Email</Label>
                  <Input
                    id="confirmEmail"
                    type="email"
                    {...emailForm.register("confirmEmail")}
                    aria-invalid={!!emailForm.formState.errors.confirmEmail}
                  />
                  {emailForm.formState.errors.confirmEmail && (
                    <p className="text-sm text-destructive">
                      {emailForm.formState.errors.confirmEmail.message}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={emailForm.formState.isSubmitting}
                  className="bg-[#EE0505] hover:bg-red-700 hover:shadow-lg  cursor-pointer"
                >
                  {emailForm.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Email
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
