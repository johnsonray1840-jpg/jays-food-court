import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAuthorization } from '@/lib/auth';
import {
  getCustomizationGroups,
  saveCustomizationGroups,
  getMealGroupLinks,
  saveMealGroupLinks,
  setMealGroups,
  CustomizationGroupConfig,
  CustomizationOptionConfig
} from '@/lib/customizations-service';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

const optionSchema = z.object({
  id: z.string().trim().min(1),
  groupId: z.string().trim().min(1),
  name: z.string().trim().min(1, 'Option name is required'),
  additionalPrice: z.number().min(0, 'Price must be non-negative'),
  isAvailable: z.boolean().default(true),
  minQuantity: z.number().int().min(0).default(0),
  maxQuantity: z.number().int().min(1).default(10),
  displayOrder: z.number().int().default(0),
  desc: z.string().optional()
});

const groupSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1, 'Group name is required'),
  description: z.string().optional(),
  selectionType: z.enum(['single', 'multiple', 'quantity']).default('quantity'),
  minSelectable: z.number().int().min(0).default(0),
  maxSelectable: z.number().int().min(1).default(10),
  includedQuantity: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(false),
  allowMultipleCombinations: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  options: z.array(optionSchema).default([])
});

const updateGroupsPayloadSchema = z.object({
  action: z.enum([
    'save_groups',
    'create_group',
    'update_group',
    'delete_group',
    'toggle_option_availability',
    'set_meal_groups'
  ]),
  groups: z.array(groupSchema).optional(),
  group: groupSchema.optional(),
  groupId: z.string().optional(),
  optionId: z.string().optional(),
  isAvailable: z.boolean().optional(),
  mealId: z.number().optional(),
  attachedGroupIds: z.array(z.string()).optional()
});

// GET: Retrieve all customization groups and meal attachments
export async function GET(req: NextRequest) {
  try {
    const groups = getCustomizationGroups();
    const links = getMealGroupLinks();

    return NextResponse.json(
      {
        success: true,
        groups,
        mealLinks: links
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve customizations' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

// POST: Manage groups, options, reordering, and meal attachments (Owner / Manager / Admin)
export async function POST(req: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffAuthorization(req, ['owner', 'admin', 'manager']);
    if (errorResponse || !staff) {
      return errorResponse || NextResponse.json({ error: 'Unauthorized staff action' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = updateGroupsPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid customization payload', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { action, groups, group, groupId, optionId, isAvailable, mealId, attachedGroupIds } = parseResult.data;
    let currentGroups = getCustomizationGroups();

    if (action === 'save_groups' && groups) {
      saveCustomizationGroups(groups);
      return NextResponse.json({ success: true, message: 'All customization groups saved successfully', groups });
    }

    if (action === 'create_group' && group) {
      if (currentGroups.some((g) => g.id === group.id)) {
        return NextResponse.json({ error: 'A customization group with this ID already exists' }, { status: 400 });
      }
      currentGroups.push(group);
      saveCustomizationGroups(currentGroups);
      return NextResponse.json({ success: true, message: `Group "${group.name}" created`, groups: currentGroups });
    }

    if (action === 'update_group' && group) {
      const idx = currentGroups.findIndex((g) => g.id === group.id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Customization group not found' }, { status: 404 });
      }
      currentGroups[idx] = group;
      saveCustomizationGroups(currentGroups);
      return NextResponse.json({ success: true, message: `Group "${group.name}" updated`, groups: currentGroups });
    }

    if (action === 'delete_group' && groupId) {
      currentGroups = currentGroups.filter((g) => g.id !== groupId);
      saveCustomizationGroups(currentGroups);

      // Clean up references in meal links
      const currentLinks = getMealGroupLinks();
      const cleanedLinks = currentLinks.map((l) => ({
        ...l,
        groupIds: l.groupIds.filter((g) => g !== groupId)
      }));
      saveMealGroupLinks(cleanedLinks);

      return NextResponse.json({ success: true, message: 'Group deleted', groups: currentGroups });
    }

    if (action === 'toggle_option_availability' && groupId && optionId && isAvailable !== undefined) {
      const grp = currentGroups.find((g) => g.id === groupId);
      if (!grp) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      }
      const opt = grp.options.find((o) => o.id === optionId);
      if (!opt) {
        return NextResponse.json({ error: 'Option not found' }, { status: 404 });
      }
      opt.isAvailable = isAvailable;
      saveCustomizationGroups(currentGroups);
      return NextResponse.json({
        success: true,
        message: `Option "${opt.name}" marked ${isAvailable ? 'available' : 'unavailable'}`,
        groups: currentGroups
      });
    }

    if (action === 'set_meal_groups' && mealId !== undefined && attachedGroupIds) {
      setMealGroups(mealId, attachedGroupIds);
      return NextResponse.json({
        success: true,
        message: `Updated attached groups for meal #${mealId}`,
        mealLinks: getMealGroupLinks()
      });
    }

    return NextResponse.json({ error: 'Unsupported customization action' }, { status: 400 });
  } catch (err: any) {
    console.error('Customization API error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error processing customization request' },
      { status: 500 }
    );
  }
}
