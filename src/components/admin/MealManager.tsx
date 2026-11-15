'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Flame,
  AlertTriangle,
  RefreshCw,
  Save,
  X,
  Layers,
  DollarSign,
  Image as ImageIcon
} from 'lucide-react';
import { MenuItem } from '@/types';
import { formatNaira } from '@/lib/utils';

interface MealManagementProps {
  menuItems: MenuItem[];
  onRefresh: () => void;
  staffRole?: string;
  staffName?: string;
}

const CATEGORIES = [
  'All Categories',
  'Soups & Swallows',
  'Rice',
  'Yam & Sides',
  'Snacks & Shawarma',
  'Drinks'
] as const;

const AVAILABLE_IMAGES = [
  { id: 'jollof-rice', label: 'Jollof Rice' },
  { id: 'jollof-plantain', label: 'Jollof & Plantain' },
  { id: 'fried-rice', label: 'Fried Rice' },
  { id: 'white-rice-stew', label: 'White Rice & Stew' },
  { id: 'native-rice', label: 'Native Rice' },
  { id: 'egusi', label: 'Egusi Soup' },
  { id: 'ogbono', label: 'Ogbono Soup' },
  { id: 'oha', label: 'Oha Soup' },
  { id: 'bitterleaf', label: 'Bitterleaf Soup' },
  { id: 'yam-egg', label: 'Yam & Egg Sauce' },
  { id: 'plantain', label: 'Fried Plantains' },
  { id: 'moimoi', label: 'Moimoi' },
  { id: 'shawarma', label: 'Chicken Shawarma' },
  { id: 'meatpie', label: 'Meatpie' },
  { id: 'cake', label: 'Celebration Cake' },
  { id: 'chinchin', label: 'Crunchy Chin Chin' },
  { id: 'drinks', label: 'Chilled Drinks & Zobo' }
];

export function MealManager({ menuItems, onRefresh, staffRole, staffName }: MealManagementProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'sold_out'>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState<number>(3000);
  const [formCategory, setFormCategory] = useState<string>('Rice');
  const [formImage, setFormImage] = useState<string>('jollof-rice');
  const [formAvailable, setFormAvailable] = useState<boolean>(true);
  const [formSwallow, setFormSwallow] = useState<boolean>(false);
  const [formRating, setFormRating] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  // Filtered catalog
  const filteredMeals = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.desc.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All Categories' || item.cat === selectedCategory;
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'available' && item.available) ||
        (stockFilter === 'sold_out' && !item.available);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [menuItems, search, selectedCategory, stockFilter]);

  const showFeedback = (text: string, isError = false) => {
    setActionFeedback({ text, isError });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleOpenCreate = () => {
    setFormName('');
    setFormDesc('');
    setFormPrice(3000);
    setFormCategory('Rice');
    setFormImage('jollof-rice');
    setFormAvailable(true);
    setFormSwallow(false);
    setFormRating('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormDesc(item.desc);
    setFormPrice(item.price);
    setFormCategory(item.cat);
    setFormImage(item.img || 'jollof-rice');
    setFormAvailable(item.available);
    setFormSwallow(Boolean(item.swallow));
    setFormRating(item.rating || '');
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDesc.trim() || formPrice < 100) {
      showFeedback('Please fill all required meal details with a valid price', true);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/menu/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          desc: formDesc.trim(),
          price: formPrice,
          cat: formCategory,
          img: formImage,
          available: formAvailable,
          swallow: formCategory === 'Soups & Swallows' ? true : formSwallow,
          rating: formRating.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || 'Meal created successfully!');
        setIsCreateModalOpen(false);
        onRefresh();
      } else {
        showFeedback(data.error || 'Failed to create meal', true);
      }
    } catch {
      showFeedback('Network connection error while saving meal', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/menu/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          desc: formDesc.trim(),
          price: formPrice,
          cat: formCategory,
          img: formImage,
          available: formAvailable,
          swallow: formCategory === 'Soups & Swallows' ? true : formSwallow,
          rating: formRating.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || 'Meal updated successfully!');
        setEditingItem(null);
        onRefresh();
      } else {
        showFeedback(data.error || 'Failed to update meal', true);
      }
    } catch {
      showFeedback('Network connection error while updating meal', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStock = async (item: MenuItem) => {
    try {
      const nextState = !item.available;
      const res = await fetch(`/api/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: nextState })
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback(`${item.name} is now ${nextState ? 'Available' : 'Sold Out'}`);
        onRefresh();
      } else {
        showFeedback(data.error || 'Failed to toggle availability', true);
      }
    } catch {
      showFeedback('Network error toggling meal stock', true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/menu/${deletingItem.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || 'Meal removed successfully!');
        setDeletingItem(null);
        onRefresh();
      } else {
        showFeedback(data.error || 'Failed to remove meal', true);
      }
    } catch {
      showFeedback('Network error removing meal', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg transition animate-in fade-in slide-in-from-top-2 ${
            actionFeedback.isError
              ? 'bg-rose-950/90 text-rose-200 border border-rose-800'
              : 'bg-emerald-950/90 text-emerald-200 border border-emerald-800'
          }`}
        >
          <span>{actionFeedback.text}</span>
          <button onClick={() => setActionFeedback(null)} className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-black text-white tracking-tight">Meal Catalog & Menu Management</h3>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Full administrative control over store dishes, authoritative pricing, categories, customizations and stock.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center gap-2 text-xs font-bold transition shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Dish</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
            title="Refresh Menu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search meals by dish name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-500 transition"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-500 transition"
          >
            <option value="all">All Availability</option>
            <option value="available">In Stock Only</option>
            <option value="sold_out">Sold Out Only</option>
          </select>
        </div>
      </div>

      {/* Meals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMeals.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-3xl bg-zinc-900 border transition hover:border-zinc-700 flex flex-col justify-between ${
              item.available ? 'border-zinc-800' : 'border-zinc-800/50 opacity-80'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    {item.cat}
                  </span>
                  <h4 className="font-bold text-base text-white mt-1.5">{item.name}</h4>
                </div>

                <button
                  onClick={() => handleToggleStock(item)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                    item.available
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800 hover:bg-emerald-900'
                      : 'bg-rose-950/80 text-rose-400 border-rose-800 hover:bg-rose-900'
                  }`}
                  title="Click to toggle availability"
                >
                  {item.available ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      <span>Available</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      <span>Sold Out</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{item.desc}</p>

              {item.swallow && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 font-medium">
                  <Flame className="w-3 h-3 text-amber-500" />
                  <span>Includes swallow pairing options</span>
                </div>
              )}
            </div>

            <div className="pt-3 mt-4 border-t border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Base Price</span>
                <span className="text-sm font-black text-amber-400">{formatNaira(item.price)}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1"
                  title="Edit dish specifications and price"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => setDeletingItem(item)}
                  className="p-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900 border border-rose-900/50 text-rose-300 transition"
                  title="Delete or Archive Dish"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredMeals.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-zinc-900 border border-zinc-800">
          <p className="text-sm font-bold text-zinc-400">No meals found matching your search and category filter.</p>
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h4 className="text-base font-black text-white">Add New Meal to Menu</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Define meal specifications, category, and price.</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Seafood Okro Delight"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Culinary Description *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe ingredients, preparation, and portion size..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Base Price (₦) *
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-bold text-amber-400 outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Food Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      setFormCategory(e.target.value);
                      if (e.target.value === 'Soups & Swallows') setFormSwallow(true);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                  >
                    {CATEGORIES.filter((c) => c !== 'All Categories').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Image Asset
                  </label>
                  <select
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                  >
                    {AVAILABLE_IMAGES.map((img) => (
                      <option key={img.id} value={img.id}>
                        {img.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Badge / Tag (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chef Choice"
                    value={formRating}
                    onChange={(e) => setFormRating(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Immediate Stock Availability</span>
                  <span className="text-[10px] text-zinc-400">Show this meal live on the storefront for ordering</span>
                </div>
                <input
                  type="checkbox"
                  checked={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
                >
                  {isSubmitting ? 'Saving...' : 'Add Meal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h4 className="text-base font-black text-white">Edit Dish #{editingItem.id}</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update specifications. Past order records remain immutable.
                </p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Culinary Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Price (₦) *
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-bold text-amber-400 outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      setFormCategory(e.target.value);
                      if (e.target.value === 'Soups & Swallows') setFormSwallow(true);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                  >
                    {CATEGORIES.filter((c) => c !== 'All Categories').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Image Asset
                  </label>
                  <select
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                  >
                    {AVAILABLE_IMAGES.map((img) => (
                      <option key={img.id} value={img.id}>
                        {img.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Badge / Tag
                  </label>
                  <input
                    type="text"
                    value={formRating}
                    onChange={(e) => setFormRating(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Availability Status</span>
                  <span className="text-[10px] text-zinc-400">Available for customer checkout</span>
                </div>
                <input
                  type="checkbox"
                  checked={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
                >
                  {isSubmitting ? 'Saving...' : 'Update Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / ARCHIVE CONFIRMATION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-black text-white">Delete / Archive Meal?</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Are you sure you want to remove <strong>{deletingItem.name}</strong>?
              </p>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 text-left mt-3">
                <span className="font-bold text-zinc-300 block mb-0.5">Audit & Referential Safety:</span>
                If this meal is referenced in previous customer orders, it will be safely <strong>archived and marked out-of-stock</strong> to ensure past receipt records and financial ledgers remain completely intact.
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/30"
              >
                {isSubmitting ? 'Processing...' : 'Confirm Removal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
