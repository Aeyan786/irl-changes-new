import { z } from "zod"

// US State codes
export const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
] as const

// US States with labels for dropdowns
export const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
] as const

// Gender options
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const

// Regex patterns
export const patterns = {
  // US ZIP code: 5 digits or 5+4 format (e.g., 12345 or 12345-6789)
  usZipCode: /^\d{5}(-\d{4})?$/,
  // US phone number: various formats
  usPhone: /^(\+1)?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
  // Password: min 8 chars, at least one uppercase, lowercase, number
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
}

// Export ZIP_REGEX directly for convenience
export const ZIP_REGEX = patterns.usZipCode

// Email validation schema
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    patterns.strongPassword,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  )

// Basic password (for login - less strict)
export const basicPasswordSchema = z
  .string()
  .min(1, "Password is required")

// US Address schema
export const usAddressSchema = z.object({
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.enum(US_STATE_CODES, {
    errorMap: () => ({ message: "Please select a valid US state" }),
  }),
  zipCode: z
    .string()
    .min(1, "ZIP code is required")
    .regex(ZIP_REGEX, "Please enter a valid ZIP code (e.g., 12345 or 12345-6789)"),
})

// Phone schema
export const phoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => !val || patterns.usPhone.test(val),
    "Please enter a valid US phone number"
  )

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: basicPasswordSchema,
})

// Sign up form schema
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Please confirm your password"),
  firstName: z.string().min(1, "First name is required").max(50, "First name is too long"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name is too long"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

// Reset password schema
export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

// Magic link / OTP schema
export const magicLinkSchema = z.object({
  email: emailSchema,
})

// OTP verification schema
export const otpSchema = z.object({
  email: emailSchema,
  token: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "OTP must contain only numbers"),
})

// Profile update schema
export const profileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name is too long"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name is too long"),
  phone: phoneSchema,
  address: usAddressSchema.optional(),
})

// Types
export type LoginFormData = z.infer<typeof loginSchema>
export type SignUpFormData = z.infer<typeof signUpSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type MagicLinkFormData = z.infer<typeof magicLinkSchema>
export type OtpFormData = z.infer<typeof otpSchema>
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>
export type UsAddress = z.infer<typeof usAddressSchema>
