import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name is too long'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters')
      .max(72, 'Password is too long'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const deliveryInfoSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z
    .string()
    .min(10, 'Please enter a valid phone number')
    .max(15, 'Phone number is too long')
    .regex(/^[+]?[\d\s-]+$/, 'Please enter a valid phone number'),
  address: z.string().min(10, 'Please enter your full delivery address'),
  city: z.string().min(2, 'City is required'),
  instructions: z.string().max(200, 'Instructions are too long').optional(),
});

export const inventoryAdjustmentSchema = z.object({
  adjustment: z
    .number()
    .int('Adjustment must be a whole number')
    .refine((v) => v !== 0, 'Adjustment cannot be zero'),
  reason: z.string().max(200, 'Reason is too long').optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type DeliveryInfoFormData = z.infer<typeof deliveryInfoSchema>;
export type InventoryAdjustmentFormData = z.infer<typeof inventoryAdjustmentSchema>;
