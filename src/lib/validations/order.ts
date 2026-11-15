import { z } from 'zod';
import { isValidNigerianPhone } from '../phone';
import { isCoordinateWithinEnugu } from '../enugu-geocoding';

export const orderItemPortionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(20)
});

export const orderItemProteinSchema = orderItemPortionSchema;
export const orderItemSwallowSchema = orderItemPortionSchema;
export const orderItemAddonSchema = orderItemPortionSchema;

export const orderItemSchema = z
  .object({
    id: z.union([z.string().min(1), z.number().int().positive()]).optional(),
    menuItemId: z.union([z.string().min(1), z.number().int().positive()]).optional(),
    menuId: z.union([z.string().min(1), z.number().int().positive()]).optional(),
    quantity: z.number().int().min(1).max(50).optional(),
    qty: z.number().int().min(1).max(50).optional(),
    customizationOptionIds: z.array(z.string()).optional(),
    extras: z.array(z.string()).optional(),
    proteins: z.array(orderItemProteinSchema).optional(),
    swallows: z.array(orderItemSwallowSchema).optional(),
    addons: z.array(orderItemAddonSchema).optional(),
    swallow: z.string().optional().nullable(),
    notes: z.string().max(200, { message: 'Instructions cannot exceed 200 characters' }).optional(),
    note: z.string().max(200, { message: 'Instructions cannot exceed 200 characters' }).optional(),
    // Client-supplied prices and names are strictly stripped & ignored
    name: z.string().optional(),
    unit: z.number().optional()
  })
  .refine((data) => data.menuItemId !== undefined || data.menuId !== undefined || data.id !== undefined, {
    message: 'Each order item must specify a valid menu dish reference'
  });

export const createOrderSchema = z
  .object({
    idempotencyKey: z.string().trim().max(100).optional(),
    promoCode: z.string().trim().max(30).optional(),
    deliveryZoneId: z.string().trim().optional(),
    deliveryCoordinates: z
      .object({
        latitude: z.number(),
        longitude: z.number()
      })
      .optional(),
    accuracyMeters: z.number().optional(),
    selectionMethod: z.enum(['gps', 'map_pin', 'manual_search', 'manual_entry']).optional(),
    locationConfirmedAt: z.string().optional(),
    recipientName: z.string().trim().max(100).optional(),
    state: z.string().default('Enugu'),
    city: z.string().default('Enugu'),
    area: z.string().optional(),
    streetAddress: z.string().trim().max(255).optional(),
    buildingNumber: z.string().trim().max(100).optional(),
    addressId: z.string().uuid().optional(),
    customerName: z.string().trim().min(2, { message: 'Full name must be at least 2 characters' }).max(100).optional(),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((val) => !val || isValidNigerianPhone(val), {
        message: 'Please provide a valid 11-digit Nigerian phone number (e.g. 08012345678 or +234...)'
      }),
    email: z
      .string()
      .trim()
      .email({ message: 'Please enter a valid email address' })
      .optional()
      .or(z.literal('')),
    address: z.string().trim().max(255).optional(),
    landmark: z.string().trim().max(150).optional().or(z.literal('')),
    deliveryInstructions: z.string().trim().max(300).optional().or(z.literal('')),
    paymentMode: z.enum(['online', 'transfer', 'card'] as const).default('online'),
    items: z.array(orderItemSchema).min(1, { message: 'Your bag cannot be empty' })
  })
  .refine(
    (data) => {
      // Must have either addressId OR full guest delivery details
      if (data.addressId) return true;
      return Boolean(data.customerName && data.phone && data.address && data.address.trim().length >= 4);
    },
    {
      message: 'Please provide complete delivery details (Name, Phone, and Delivery Address in Enugu)'
    }
  )
  .refine(
    (data) => {
      // If deliveryCoordinates are supplied, they must be strictly within Enugu State
      if (data.deliveryCoordinates) {
        return isCoordinateWithinEnugu(data.deliveryCoordinates);
      }
      return true;
    },
    {
      message: 'Delivery is strictly restricted to locations within and around Enugu State.'
    }
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
