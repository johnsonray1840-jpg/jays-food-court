import { getSupabaseAdminClient } from './supabase/admin';
import { normalizeNigerianPhone } from './phone';
import crypto from 'crypto';

export interface CustomerProfile {
  id: string;
  phone: string;
  fullName: string;
  email: string | null;
}

export interface AddressRecord {
  id: string;
  customerId: string;
  streetAddress: string;
  landmark: string | null;
  city: string;
  state: string;
  isDefault: boolean;
}

/**
 * Normalizes phone number, finds or creates customer record, and records delivery address.
 * Never treats possession of phone number as full auth.
 */
export async function getOrCreateCustomer({
  fullName,
  phone,
  email,
  streetAddress,
  landmark,
  authenticatedCustomerId
}: {
  fullName: string;
  phone: string;
  email?: string;
  streetAddress: string;
  landmark?: string;
  authenticatedCustomerId?: string;
}): Promise<{ customer: CustomerProfile; addressId?: string; isNewCustomer: boolean } | null> {
  const normalizedPhone = normalizeNigerianPhone(phone);
  if (!normalizedPhone) {
    throw new Error('Invalid Nigerian phone number format.');
  }

  const supabase = getSupabaseAdminClient();

  // If Supabase is connected to database
  if (supabase) {
    // 1. Look up existing customer by normalized phone
    const { data: existingCustomer, error: findError } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (findError) {
      console.error('Customer lookup error:', findError);
      throw new Error('Database error while resolving customer record.');
    }

    let customerId: string;
    let finalCustomer: CustomerProfile;
    let isNewCustomer = false;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      finalCustomer = {
        id: existingCustomer.id,
        phone: existingCustomer.phone,
        fullName: existingCustomer.full_name,
        email: existingCustomer.email
      };
      // Do NOT overwrite existing customer's name and email on unauthenticated guest checkout!
    } else {
      // Create new customer (handling concurrent duplicate insert race on unique phone)
      isNewCustomer = true;
      const newId = crypto.randomUUID();
      const { data: created, error: insertError } = await supabase
        .from('customers')
        .insert({
          id: newId,
          phone: normalizedPhone,
          full_name: fullName.trim(),
          email: email?.trim() || null
        })
        .select()
        .single();

      if (insertError) {
        const isDuplicatePhone =
          insertError.code === '23505' ||
          String(insertError.message || '').toLowerCase().includes('duplicate key');

        if (isDuplicatePhone) {
          const { data: racedCustomer } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', normalizedPhone)
            .maybeSingle();

          if (racedCustomer) {
            isNewCustomer = false;
            customerId = racedCustomer.id;
            finalCustomer = {
              id: racedCustomer.id,
              phone: racedCustomer.phone,
              fullName: racedCustomer.full_name,
              email: racedCustomer.email
            };
          } else {
            throw new Error('Failed to resolve customer record after duplicate phone check.');
          }
        } else {
          throw new Error('Failed to create customer record in database.');
        }
      } else if (created) {
        customerId = created.id;
        finalCustomer = {
          id: created.id,
          phone: created.phone,
          fullName: created.full_name,
          email: created.email
        };
      } else {
        throw new Error('Failed to create customer record in database.');
      }
    }

    // 2. Support multiple delivery addresses (only mutate saved address book for new customer or authenticated owner)
    let addressId: string | undefined;
    if (isNewCustomer || authenticatedCustomerId === customerId) {
      const cleanStreet = streetAddress.trim();
      const cleanLandmark = landmark?.trim() || null;

      const { data: existingAddr } = await supabase
        .from('customer_addresses')
        .select('id')
        .eq('customer_id', customerId)
        .ilike('street_address', cleanStreet)
        .maybeSingle();

      if (existingAddr) {
        addressId = existingAddr.id;
      } else {
        const newAddrId = crypto.randomUUID();
        const { data: newAddr } = await supabase
          .from('customer_addresses')
          .insert({
            id: newAddrId,
            customer_id: customerId,
            street_address: cleanStreet,
            landmark: cleanLandmark,
            city: 'Agbani',
            state: 'Enugu',
            is_default: isNewCustomer
          })
          .select('id')
          .single();

        if (newAddr) addressId = newAddr.id;
      }
    }

    return { customer: finalCustomer, addressId, isNewCustomer };
  }

  // Graceful fallback if Supabase credentials are not yet entered
  const fallbackId = 'cust-' + crypto.createHash('md5').update(normalizedPhone).digest('hex').slice(0, 12);
  return {
    customer: {
      id: fallbackId,
      phone: normalizedPhone,
      fullName: fullName.trim(),
      email: email?.trim() || null
    },
    isNewCustomer: true
  };
}
