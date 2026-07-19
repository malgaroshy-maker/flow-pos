import React, { useState } from 'react';
import type { Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatLYD } from '../lib/money';
import { Icons } from '../components/Icons';

interface ProductsProps {
  onOpenNewProductModal: () => void;
  onStartEditProduct: (product: Product) => void;
  onOpenAdjustModal: (product: Product) => void;
  onViewMovements: (product: Product) => void;
}

export const ProductsScreen: React.FC<ProductsProps> = ({
  onOpenNewProductModal,
  onStartEditProduct,
  onOpenAdjustModal,
  onViewMovements,
}) => {
  const { currentUser } = useAuth();
  const { productsList } = useData();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = [
    'ALL',
    ...Array.from(new Set(productsList.map((p) => p.category.toUpperCase()))),
  ];

  const filteredProducts = productsList.filter((p) => {
    const matchesCategory =
      selectedCategory === 'ALL' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search)) ||
      (p.serialNumber && p.serialNumber.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <span className="mono text-xs tracking-widest text-copper">إدارة المخزون</span>
          <h1 className="text-3xl font-extrabold">المنتجات والمعدات</h1>
        </div>
        {currentUser?.role === 'manager' && (
          <button
            onClick={onOpenNewProductModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
          >
            <Icons.Plus className="h-4 w-4" /> إضافة منتج جديد
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface border border-line p-4 rounded-card shadow-sm">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المنتج، الباركد، أو السيريال..."
            className="w-full h-10 pr-10 pl-3 rounded-control border border-line bg-surface text-sm focus-visible:outline-none focus:border-jade"
          />
          <div className="absolute right-3 top-2.5">
            <Icons.Search />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-jade text-white'
                  : 'bg-surface-2 text-muted border border-border hover:text-text'
              }`}
            >
              {cat === 'ALL' ? 'جميع الأقسام' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface-2 text-text font-bold border-b border-line">
              <tr>
                <th className="p-3">صورة</th>
                <th className="p-3">اسم المنتج</th>
                <th className="p-3">النوع</th>
                <th className="p-3">القسم</th>
                <th className="p-3">سعر التجزئة</th>
                <th className="p-3">المخزون الحالي</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="p-3">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-10 h-10 object-cover rounded-control border border-line"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-control bg-surface-2 border border-line flex items-center justify-center text-muted font-bold text-[10px]">
                        بلا صورة
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-semibold">
                    <div>{p.name}</div>
                    {p.barcode && <div className="text-[10px] text-muted mono">{p.barcode}</div>}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.type === 'equipment'
                          ? 'bg-copper/10 text-copper border border-copper/30'
                          : 'bg-jade/10 text-jade border border-jade/30'
                      }`}
                    >
                      {p.type === 'equipment' ? 'معدة/جهاز' : 'استهلاكي'}
                    </span>
                  </td>
                  <td className="p-3">{p.category}</td>
                  <td className="p-3 mono font-bold text-jade">{formatLYD(p.retailPrice)} د.ل</td>
                  <td className="p-3 mono">
                    <span
                      className={`font-bold ${
                        p.quantity <= p.reorderPoint ? 'text-alert' : 'text-text'
                      }`}
                    >
                      {p.quantity} {p.baseUnit}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {currentUser?.role === 'manager' && (
                        <>
                          <button
                            onClick={() => onStartEditProduct(p)}
                            className="px-2.5 py-1 text-xs border border-border rounded text-muted hover:text-text cursor-pointer"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => onOpenAdjustModal(p)}
                            className="px-2.5 py-1 text-xs border border-border bg-surface-2 rounded text-muted hover:text-text cursor-pointer"
                          >
                            تسوية
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onViewMovements(p)}
                        className="px-2.5 py-1 text-xs border border-border text-muted hover:text-text rounded cursor-pointer"
                      >
                        سجل الحركات
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
