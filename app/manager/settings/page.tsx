"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, User, Lock, Mail, Save, Eye, EyeOff, MapPin, Phone, Calendar, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { updateProfile, changePassword, changeEmail, type UpdateProfileData } from "@/app/actions/auth"
import { US_STATES, GENDER_OPTIONS, patterns, ZIP_REGEX } from "@/lib/validations"

// Profile form schema for managers (no runner-specific fields)
const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  phone: z.string().regex(/^[+]?[\d\s\-().]{7,20}$/, "Invalid phone number").optional().or(z.literal("")),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().regex(ZIP_REGEX, "Invalid ZIP code format"),
  age: z.coerce.number().min(18, "Must be at least 18 years old"),
  gender: z.enum(["male", "female", "other"]),
})

// Password form schema
const passwordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(patterns.strongPassword, "Must contain uppercase, lowercase, and number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

// Email form schema
const emailSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
  confirmEmail: z.string().email("Invalid email address"),
}).refine((data) => data.newEmail === data.confirmEmail, {
  message: "Email addresses do not match",
  path: ["confirmEmail"],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>
type EmailFormData = z.infer<typeof emailSchema>

export default function ManagerSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [currentEmail, setCurrentEmail] = useState("")
  const [teamsManaged, setTeamsManaged] = useState(0)

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

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      newEmail: "",
      confirmEmail: "",
    },
  })

  // Load user data
  useEffect(() => {
    async function loadUserData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setCurrentEmail(user.email || "")
        
        // Get profile from database
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
            phone: profile.phone || "",
            street: address?.street || "",
            city: address?.city || "",
            state: address?.state || "",
            zipCode: address?.zipCode || "",
            age: profile.age || 18,
            gender: profile.gender || "male",
          })
        }

        // Get teams count
        const { count } = await supabase
          .from("teams")
          .select("*", { count: "exact", head: true })
          .eq("manager_id", user.id)

        setTeamsManaged(count || 0)
      }
      setLoading(false)
    }
    loadUserData()
  }, [profileForm])

  async function onProfileSubmit(data: ProfileFormData) {
    setProfileLoading(true)
    try {
      const result = await updateProfile(data as UpdateProfileData)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully updated.",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setProfileLoading(false)
    }
  }

  async function onPasswordSubmit(data: PasswordFormData) {
    setPasswordLoading(true)
    try {
      const result = await changePassword(data.oldPassword, data.newPassword)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Password Changed",
          description: "Your password has been successfully updated.",
        })
        passwordForm.reset()
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  async function onEmailSubmit(data: EmailFormData) {
    setEmailLoading(true)
    try {
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
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setEmailLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container-responsive py-6 md:py-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4 hidden sm:inline" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <Lock className="h-4 w-4 hidden sm:inline" />
            Password
          </TabsTrigger>
          {/* <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4 hidden sm:inline" />
            Email
          </TabsTrigger> */}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Update Profile
              </CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                {/* Manager Stats */}
                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span>You are managing <strong className="text-foreground">{teamsManaged}</strong> team{teamsManaged !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      {...profileForm.register("firstName")}
                      placeholder="John"
                    />
                    {profileForm.formState.errors.firstName && (
                      <p className="text-sm text-destructive">{profileForm.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      {...profileForm.register("lastName")}
                      placeholder="Doe"
                    />
                    {profileForm.formState.errors.lastName && (
                      <p className="text-sm text-destructive">{profileForm.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg flex items-center gap-2 text-foreground">
                    <Phone className="h-4 w-4 text-primary" />
                    Contact Info
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      {...profileForm.register("phone")}
                    />
                    {profileForm.formState.errors.phone && (
                      <p className="text-sm text-destructive">{profileForm.formState.errors.phone.message}</p>
                    )}
                  </div>
                </div>

                {/* Address Section */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg flex items-center gap-2 text-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    Address
                  </h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address *</Label>
                    <Input
                      id="street"
                      {...profileForm.register("street")}
                      placeholder="123 Main St"
                    />
                    {profileForm.formState.errors.street && (
                      <p className="text-sm text-destructive">{profileForm.formState.errors.street.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        {...profileForm.register("city")}
                        placeholder="New York"
                      />
                      {profileForm.formState.errors.city && (
                        <p className="text-sm text-destructive">{profileForm.formState.errors.city.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Select
                        value={profileForm.watch("state")}
                        onValueChange={(value) => profileForm.setValue("state", value)}
                      >
                        <SelectTrigger>
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
                        <p className="text-sm text-destructive">{profileForm.formState.errors.state.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP Code *</Label>
                      <Input
                        id="zipCode"
                        {...profileForm.register("zipCode")}
                        placeholder="10001"
                      />
                      {profileForm.formState.errors.zipCode && (
                        <p className="text-sm text-destructive">{profileForm.formState.errors.zipCode.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg flex items-center gap-2 text-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    Personal Details
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="age">Age *</Label>
                      <Input
                        id="age"
                        type="number"
                        min={18}
                        {...profileForm.register("age")}
                      />
                      {profileForm.formState.errors.age && (
                        <p className="text-sm text-destructive">{profileForm.formState.errors.age.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender *</Label>
                      <Select
                        value={profileForm.watch("gender")}
                        onValueChange={(value) => profileForm.setValue("gender", value as "male" | "female" | "other")}
                      >
                        <SelectTrigger>
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
                        <p className="text-sm text-destructive">{profileForm.formState.errors.gender.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={profileLoading} className="w-full sm:w-auto bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer">
                  {profileLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Current Password *</Label>
                  <div className="relative">
                    <Input
                      id="oldPassword"
                      type={showOldPassword ? "text" : "password"}
                      {...passwordForm.register("oldPassword")}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                    >
                      {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {passwordForm.formState.errors.oldPassword && (
                    <p className="text-sm text-destructive">{passwordForm.formState.errors.oldPassword.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password *</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      {...passwordForm.register("newPassword")}
                      placeholder="Enter new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-sm text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters with uppercase, lowercase, and number
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...passwordForm.register("confirmPassword")}
                    placeholder="Confirm new password"
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button type="submit" disabled={passwordLoading} className="w-full sm:w-auto bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer">
                  {passwordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Update Password
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tab */}
        {/* <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Change Email
              </CardTitle>
              <CardDescription>
                Update your email address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4 max-w-md">
                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    Current email: <span className="font-medium text-foreground">{currentEmail}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newEmail">New Email Address *</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    {...emailForm.register("newEmail")}
                    placeholder="newemail@example.com"
                  />
                  {emailForm.formState.errors.newEmail && (
                    <p className="text-sm text-destructive">{emailForm.formState.errors.newEmail.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmEmail">Confirm New Email *</Label>
                  <Input
                    id="confirmEmail"
                    type="email"
                    {...emailForm.register("confirmEmail")}
                    placeholder="Confirm new email"
                  />
                  {emailForm.formState.errors.confirmEmail && (
                    <p className="text-sm text-destructive">{emailForm.formState.errors.confirmEmail.message}</p>
                  )}
                </div>

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    A verification link will be sent <strong className="text-foreground">only to your new email address</strong>.
                    Click the link to confirm the change. No email will be sent to your current address.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={emailLoading} 
                  className="w-full sm:w-auto bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer text-white"
                >
                  {emailLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Verification
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent> */}
      </Tabs>
    </div>
  )
}
