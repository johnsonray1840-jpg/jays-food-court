'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Link as LinkIcon,
  HelpCircle,
  DollarSign
} from 'lucide-react';
import { MenuItem } from '@/types';
import { formatNaira } from '@/lib/utils';
import {
  CustomizationGroupConfig,
  CustomizationOptionConfig,
  MealCustomizationLink
} from '@/lib/customizations-service';

interface CustomizationManagerProps {
  menuItems: MenuItem[];
  onRefresh?: () => void;
}

export function CustomizationManager({ menuItems, onRefresh }: CustomizationManagerProps) {
  const [groups, setGroups] = useState<CustomizationGroupConfig[]>([]);
  const [mealLinks, setMealLinks] = useState<MealCustomizationLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Active view: 'groups' (manage groups/options) or 'attach' (attach groups to meals)
  const [activeSubTab, setActiveSubTab] = useState<'groups' | 'attach'>('groups');

  // Group editing / modal state
  const [editingGroup, setEditingGroup] = useState<CustomizationGroupConfig | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  // Option modal state inside group editor
  const [editingOption, setEditingOption] = useState<{
    groupId: string;
    option: CustomizationOptionConfig | null;
  } | null>(null);

  // Meal link editor state
  const [selectedMealId, setSelectedMealId] = useState<number>(menuItems[0]?.id || 1);

  // Fetch customizations on mount
  const fetchCustomizations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/customizations');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
        setMealLinks(data.mealLinks || []);
      } else {
        setStatusMessage({ text: 'Failed to fetch customization groups.', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Error connecting to customization service.', isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomizations();
  }, []);

  const showStatus = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Toggle option availability on the fly
  const handleToggleOption = async (groupId: string, optionId: string, currentVal: boolean) => {
    try {
      const res = await fetch('/api/admin/customizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_option_availability',
          groupId,
          optionId,
          isAvailable: !currentVal
        })
      });
      const data = await res.json();
      if (res.ok) {
        setGroups(data.groups);
        showStatus(data.message || 'Option availability updated.');
      } else {
        showStatus(data.error || 'Failed to update option availability', true);
      }
    } catch {
      showStatus('Network error updating option', true);
    }
  };

  // Save new or updated group
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    setIsSaving(true);
    try {
      const isNew = !groups.some((g) => g.id === editingGroup.id);
      const res = await fetch('/api/admin/customizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isNew ? 'create_group' : 'update_group',
          group: editingGroup
        })
      });
      const data = await res.json();
      if (res.ok) {
        setGroups(data.groups);
        setIsGroupModalOpen(false);
        setEditingGroup(null);
        showStatus(data.message || 'Group saved successfully.');
      } else {
        showStatus(data.error || 'Failed to save group', true);
      }
    } catch {
      showStatus('Network error saving group', true);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a group
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to delete customization group "${groupName}"?`)) return;

    try {
      const res = await fetch('/api/admin/customizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_group',
          groupId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setGroups(data.groups);
        showStatus('Group deleted successfully.');
      } else {
        showStatus(data.error || 'Failed to delete group', true);
      }
    } catch {
      showStatus('Network error deleting group', true);
    }
  };

  // Reorder groups
  const handleMoveGroup = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= groups.length) return;

    const newGroups = [...groups];
    const [moved] = newGroups.splice(index, 1);
    newGroups.splice(targetIdx, 0, moved);

    // Re-assign display order
    newGroups.forEach((g, idx) => {
      g.displayOrder = idx + 1;
    });

    setGroups(newGroups);

    try {
      await fetch('/api/admin/customizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_groups',
          groups: newGroups
        })
      });
    } catch {
      showStatus('Failed to persist group order', true);
    }
  };

  // Toggle group attached to meal
  const handleToggleMealGroup = async (mealId: number, groupId: string) => {
    const currentLink = mealLinks.find((l) => l.mealId === mealId);
    let updatedGroupIds: string[] = [];

    if (currentLink) {
      if (currentLink.groupIds.includes(groupId)) {
        updatedGroupIds = currentLink.groupIds.filter((g) => g !== groupId);
      } else {
        updatedGroupIds = [...currentLink.groupIds, groupId];
      }
    } else {
      updatedGroupIds = [groupId];
    }

    try {
      const res = await fetch('/api/admin/customizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_meal_groups',
          mealId,
          attachedGroupIds: updatedGroupIds
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMealLinks(data.mealLinks);
        showStatus('Meal group links updated.');
      } else {
        showStatus(data.error || 'Failed to update meal links', true);
      }
    } catch {
      showStatus('Error saving meal group links', true);
    }
  };

  const selectedMeal = menuItems.find((m) => m.id === selectedMealId);
  const activeMealGroupIds = mealLinks.find((l) => l.mealId === selectedMealId)?.groupIds || [];

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-center gap-2 ${
            statusMessage.isError
              ? 'bg-red-950/80 border-red-800 text-red-300'
              : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
          }`}
        >
          {statusMessage.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Sub Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-brand-gold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white">Customization Engine</h2>
            <p className="text-xs text-zinc-400">
              Configure portions, multi-proteins, swallows, drink add-ons, and pricing rules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('groups')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'groups'
                ? 'bg-brand-gold text-zinc-950'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Groups & Options ({groups.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('attach')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'attach'
                ? 'bg-brand-gold text-zinc-950'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Attach to Meals</span>
          </button>
          <button
            onClick={fetchCustomizations}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* SUBTAB 1: GROUPS & OPTIONS CONFIGURATION */}
      {activeSubTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Configured Customization Groups
            </h3>
            <button
              onClick={() => {
                setEditingGroup({
                  id: `grp_${Date.now()}`,
                  name: '',
                  description: '',
                  selectionType: 'quantity',
                  minSelectable: 0,
                  maxSelectable: 10,
                  includedQuantity: 0,
                  isRequired: false,
                  allowMultipleCombinations: true,
                  displayOrder: groups.length + 1,
                  options: []
                });
                setIsGroupModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-brand-gold hover:bg-amber-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Group</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {groups.map((group, gIdx) => (
              <div
                key={group.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 transition hover:border-zinc-700"
              >
                {/* Group Top Line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {gIdx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-sm sm:text-base text-white">{group.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-800 text-amber-400 border border-amber-500/20">
                          {group.selectionType}
                        </span>
                        {group.isRequired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-950 text-red-400 border border-red-800/50">
                            Required
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400">
                            Optional
                          </span>
                        )}
                        {group.includedQuantity > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                            {group.includedQuantity} Free Included
                          </span>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-xs text-zinc-400 mt-0.5">{group.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => handleMoveGroup(gIdx, 'up')}
                      disabled={gIdx === 0}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveGroup(gIdx, 'down')}
                      disabled={gIdx === groups.length - 1}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingGroup(JSON.parse(JSON.stringify(group)));
                        setIsGroupModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 transition"
                      title="Edit group"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 transition"
                      title="Delete group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Options Table inside Group */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Options & Prices ({group.options.length})
                    </span>
                    <button
                      onClick={() => {
                        const newOption: CustomizationOptionConfig = {
                          id: `opt_${Date.now()}`,
                          groupId: group.id,
                          name: '',
                          additionalPrice: 0,
                          isAvailable: true,
                          minQuantity: 0,
                          maxQuantity: 10,
                          displayOrder: group.options.length + 1
                        };
                        setEditingOption({ groupId: group.id, option: newOption });
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Option</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {group.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                          opt.isAvailable
                            ? 'bg-zinc-950/60 border-zinc-800'
                            : 'bg-zinc-950/30 border-red-950/50 opacity-60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white truncate">{opt.name}</span>
                            {!opt.isAvailable && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-950 text-red-400 font-black">
                                Sold Out
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-extrabold text-amber-400 mt-0.5">
                            +{formatNaira(opt.additionalPrice)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleToggleOption(group.id, opt.id, opt.isAvailable)}
                            className={`p-1.5 rounded-lg text-xs transition ${
                              opt.isAvailable
                                ? 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900'
                                : 'bg-red-950/60 text-red-400 hover:bg-red-900'
                            }`}
                            title={opt.isAvailable ? 'Mark Sold Out' : 'Mark Available'}
                          >
                            {opt.isAvailable ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingOption({ groupId: group.id, option: { ...opt } });
                            }}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                            title="Edit Option"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 2: ATTACH GROUPS TO MEALS */}
      {activeSubTab === 'attach' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                1. Select Meal to Configure Customizations
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {menuItems.map((m) => {
                  const isSelected = m.id === selectedMealId;
                  const attachedCount = (mealLinks.find((l) => l.mealId === m.id)?.groupIds || []).length;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMealId(m.id)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500/10 border-brand-gold text-white shadow-xs'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs truncate">{m.name}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{m.cat}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-amber-400">{formatNaira(m.price)}</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400">
                          {attachedCount} rules
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedMeal && (
              <div className="pt-4 border-t border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    Attached Customization Groups for &quot;{selectedMeal.name}&quot;
                  </h4>
                  <span className="text-xs text-zinc-400">
                    Click checkboxes to attach or detach customization groups
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groups.map((group) => {
                    const isAttached = activeMealGroupIds.includes(group.id);
                    return (
                      <div
                        key={group.id}
                        onClick={() => handleToggleMealGroup(selectedMeal.id, group.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          isAttached
                            ? 'bg-amber-500/10 border-brand-gold text-white'
                            : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition ${
                            isAttached ? 'bg-brand-gold text-zinc-950 font-black' : 'border border-zinc-700'
                          }`}
                        >
                          {isAttached && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{group.name}</span>
                            <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                              ({group.selectionType})
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{group.description}</p>
                          <p className="text-[10px] text-amber-400/90 mt-1">
                            {group.options.length} options: {group.options.map((o) => o.name).join(', ')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT / CREATE GROUP */}
      {isGroupModalOpen && editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-black text-sm sm:text-base text-white">
                {groups.some((g) => g.id === editingGroup.id) ? 'Edit Customization Group' : 'New Customization Group'}
              </h3>
              <button
                onClick={() => {
                  setIsGroupModalOpen(false);
                  setEditingGroup(null);
                }}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  placeholder="e.g. Swallow Selection, Protein Selection"
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Description / Customer Guidance
                </label>
                <input
                  type="text"
                  value={editingGroup.description || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                  placeholder="e.g. Freshly wrapped authentic swallows"
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-brand-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Selection Style
                  </label>
                  <select
                    value={editingGroup.selectionType}
                    onChange={(e) =>
                      setEditingGroup({
                        ...editingGroup,
                        selectionType: e.target.value as any
                      })
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-brand-gold"
                  >
                    <option value="quantity">Quantity Stepper (- / +)</option>
                    <option value="single">Single Selection (Radio)</option>
                    <option value="multiple">Multiple Selection (Checkboxes)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Free / Included Quantity
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={editingGroup.includedQuantity}
                    onChange={(e) =>
                      setEditingGroup({
                        ...editingGroup,
                        includedQuantity: Math.max(0, parseInt(e.target.value) || 0)
                      })
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-brand-gold"
                  />
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">1 wrap free with soup</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Min Quantity / Selection
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingGroup.minSelectable}
                    onChange={(e) =>
                      setEditingGroup({
                        ...editingGroup,
                        minSelectable: Math.max(0, parseInt(e.target.value) || 0)
                      })
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-brand-gold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Max Quantity / Selection
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingGroup.maxSelectable}
                    onChange={(e) =>
                      setEditingGroup({
                        ...editingGroup,
                        maxSelectable: Math.max(1, parseInt(e.target.value) || 1)
                      })
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-brand-gold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingGroup.isRequired}
                    onChange={(e) => setEditingGroup({ ...editingGroup, isRequired: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-gold focus:ring-brand-gold"
                  />
                  <span className="text-xs text-zinc-300 font-bold">Required to Order</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingGroup.allowMultipleCombinations}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, allowMultipleCombinations: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-brand-gold focus:ring-brand-gold"
                  />
                  <span className="text-xs text-zinc-300 font-bold">Allow Multi Combinations</span>
                </label>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-brand-gold hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Group'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT / CREATE OPTION */}
      {editingOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-black text-sm text-white">Customization Option</h3>
              <button onClick={() => setEditingOption(null)} className="p-1 rounded-lg text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Option Name
                </label>
                <input
                  type="text"
                  value={editingOption.option?.name || ''}
                  onChange={(e) =>
                    setEditingOption({
                      ...editingOption,
                      option: { ...editingOption.option!, name: e.target.value }
                    })
                  }
                  placeholder="e.g. Stockfish, Bottled Water"
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Additional Price (₦)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editingOption.option?.additionalPrice ?? 0}
                  onChange={(e) =>
                    setEditingOption({
                      ...editingOption,
                      option: {
                        ...editingOption.option!,
                        additionalPrice: Math.max(0, parseInt(e.target.value) || 0)
                      }
                    })
                  }
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={editingOption.option?.desc || ''}
                  onChange={(e) =>
                    setEditingOption({
                      ...editingOption,
                      option: { ...editingOption.option!, desc: e.target.value }
                    })
                  }
                  placeholder="e.g. Aromatic Norwegian okporoko"
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-brand-gold"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingOption.option?.isAvailable ?? true}
                    onChange={(e) =>
                      setEditingOption({
                        ...editingOption,
                        option: { ...editingOption.option!, isAvailable: e.target.checked }
                      })
                    }
                    className="w-4 h-4 rounded text-brand-gold focus:ring-brand-gold"
                  />
                  <span className="text-xs text-zinc-300 font-bold">In Stock & Available</span>
                </label>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  onClick={() => setEditingOption(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const grp = groups.find((g) => g.id === editingOption.groupId);
                    if (!grp || !editingOption.option) return;

                    const existingIdx = grp.options.findIndex((o) => o.id === editingOption.option!.id);
                    if (existingIdx >= 0) {
                      grp.options[existingIdx] = editingOption.option;
                    } else {
                      grp.options.push(editingOption.option);
                    }

                    const res = await fetch('/api/admin/customizations', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'save_groups', groups })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setGroups(data.groups);
                      setEditingOption(null);
                      showStatus('Option saved successfully.');
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-brand-gold hover:bg-amber-400 text-zinc-950 font-black text-xs"
                >
                  Save Option
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
