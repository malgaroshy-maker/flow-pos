import { pathToFileURL } from 'node:url';
import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { createDb, openDatabase } from './index.js';
import { runMigrations } from './migrate.js';
import { customers, products, settings, stockMovements, suppliers, users } from './schema.js';

export function seed(sqlite: Database.Database) {
  const db = createDb(sqlite);
  const now = new Date().toISOString();

  // 1. Seed default settings
  const existingSettings = db.select().from(settings).limit(1).all();
  if (existingSettings.length === 0) {
    db.insert(settings).values({ id: 1 }).run();
  }

  // 2. Seed default users
  const existingUsers = db.select().from(users).limit(1).all();
  if (existingUsers.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin', salt);
    const salesHash = bcrypt.hashSync('sales', salt);

    db.insert(users)
      .values([
        {
          id: 1,
          username: 'مدير',
          passwordHash: adminHash,
          pin: bcrypt.hashSync('1111', salt),
          role: 'manager',
          active: true,
          createdAt: now,
        },
        {
          id: 2,
          username: 'بائع',
          passwordHash: salesHash,
          pin: bcrypt.hashSync('2222', salt),
          role: 'sales',
          active: true,
          createdAt: now,
        },
      ])
      .run();
  }

  // 3. Seed sample products & initial stock movements if table is empty
  const existingProducts = db.select().from(products).limit(1).all();
  if (existingProducts.length === 0) {
    const sampleProducts = [
      {
        name: 'بن إيطالي اسبريسو ممتاز (1 كجم)',
        type: 'consumable' as const,
        category: 'البن والقهوة',
        baseUnit: 'كجم',
        barcode: '6901234567890',
        costPrice: 45000, // 45.000 LYD
        retailPrice: 65000, // 65.000 LYD
        wholesalePrice: 58000, // 58.000 LYD
        quantity: 50,
        reorderPoint: 10,
        createdAt: now,
      },
      {
        name: 'أكواب ورقية 8 أونص (ربطة 50 كوب)',
        type: 'consumable' as const,
        category: 'الأكواب والمستلزمات',
        baseUnit: 'ربطة',
        barcode: '6901234567891',
        costPrice: 6000, // 6.000 LYD
        retailPrice: 10000, // 10.000 LYD
        wholesalePrice: 8500, // 8.500 LYD
        quantity: 120,
        reorderPoint: 20,
        createdAt: now,
      },
      {
        name: 'أكواب بلاستيك شفاف للمشروبات الباردة 16 أونص (50 كوب)',
        type: 'consumable' as const,
        category: 'الأكواب والمستلزمات',
        baseUnit: 'ربطة',
        barcode: '6901234567892',
        costPrice: 8500, // 8.500 LYD
        retailPrice: 14000, // 14.000 LYD
        wholesalePrice: 11500, // 11.500 LYD
        quantity: 80,
        reorderPoint: 15,
        createdAt: now,
      },
      {
        name: 'سيروب فانيليا مونين (700 مل)',
        type: 'consumable' as const,
        category: 'النكهات والسيروب',
        baseUnit: 'زجاجة',
        barcode: '6901234567893',
        costPrice: 28000, // 28.000 LYD
        retailPrice: 42000, // 42.000 LYD
        wholesalePrice: 36000, // 36.000 LYD
        quantity: 30,
        reorderPoint: 5,
        createdAt: now,
      },
      {
        name: 'سيروب كراميل مونين (700 مل)',
        type: 'consumable' as const,
        category: 'النكهات والسيروب',
        baseUnit: 'زجاجة',
        barcode: '6901234567894',
        costPrice: 28000, // 28.000 LYD
        retailPrice: 42000, // 42.000 LYD
        wholesalePrice: 36000, // 36.000 LYD
        quantity: 25,
        reorderPoint: 5,
        createdAt: now,
      },
      {
        name: 'حليب كامل الدسم معقم (صندوق 12 لتر)',
        type: 'consumable' as const,
        category: 'الألبان والمشروبات',
        baseUnit: 'صندوق',
        barcode: '6901234567895',
        costPrice: 48000, // 48.000 LYD
        retailPrice: 60000, // 60.000 LYD
        wholesalePrice: 54000, // 54.000 LYD
        quantity: 40,
        reorderPoint: 10,
        createdAt: now,
      },
      {
        name: 'بودرة شوكولاتة ساخنة داكنة (1 كجم)',
        type: 'consumable' as const,
        category: 'البودرات والمشروبات',
        baseUnit: 'كجم',
        barcode: '6901234567896',
        costPrice: 22000, // 22.000 LYD
        retailPrice: 35000, // 35.000 LYD
        wholesalePrice: 30000, // 30.000 LYD
        quantity: 35,
        reorderPoint: 8,
        createdAt: now,
      },
      {
        name: 'ماصات ورقية صديقة للبيئة (باكيت 100 حبة)',
        type: 'consumable' as const,
        category: 'المستهلكات اليومية',
        baseUnit: 'باكيت',
        barcode: '6901234567897',
        costPrice: 3000, // 3.000 LYD
        retailPrice: 5500, // 5.500 LYD
        wholesalePrice: 4500, // 4.500 LYD
        quantity: 150,
        reorderPoint: 25,
        createdAt: now,
      },
      {
        name: 'آلة اسبريسو إيطالية احترافية (2 مجموعات)',
        type: 'equipment' as const,
        category: 'آلات القهوة',
        baseUnit: 'جهاز',
        barcode: '6901234567898',
        costPrice: 8500000, // 8,500.000 LYD
        retailPrice: 11200000, // 11,200.000 LYD
        wholesalePrice: 10200000, // 10,200.000 LYD
        quantity: 4,
        reorderPoint: 1,
        warrantyMonths: 24,
        serialNumber: 'ESP-2026-001',
        createdAt: now,
      },
      {
        name: 'طاحونة بن أوتوماتيكية (Mahlkönig)',
        type: 'equipment' as const,
        category: 'المطاحن والمعدات',
        baseUnit: 'جهاز',
        barcode: '6901234567899',
        costPrice: 2200000, // 2,200.000 LYD
        retailPrice: 2900000, // 2,900.000 LYD
        wholesalePrice: 2600000, // 2,600.000 LYD
        quantity: 6,
        reorderPoint: 2,
        warrantyMonths: 12,
        serialNumber: 'GRN-2026-005',
        createdAt: now,
      },
      {
        name: 'خلاط عصائر وسلاش (Vitamix)',
        type: 'equipment' as const,
        category: 'خلاطات ومحضرات',
        baseUnit: 'جهاز',
        barcode: '69012345678900',
        costPrice: 1400000, // 1,400.000 LYD
        retailPrice: 1850000, // 1,850.000 LYD
        wholesalePrice: 1650000, // 1,650.000 LYD
        quantity: 8,
        reorderPoint: 2,
        warrantyMonths: 12,
        serialNumber: 'BLD-2026-012',
        createdAt: now,
      },
      {
        name: 'صانعة ثلج مكعبات 50 كجم/يوم',
        type: 'equipment' as const,
        category: 'أجهزة التبريد والثلج',
        baseUnit: 'جهاز',
        barcode: '69012345678901',
        costPrice: 3100000, // 3,100.000 LYD
        retailPrice: 4100000, // 4,100.000 LYD
        wholesalePrice: 3700000, // 3,700.000 LYD
        quantity: 3,
        reorderPoint: 1,
        warrantyMonths: 12,
        serialNumber: 'ICE-2026-003',
        createdAt: now,
      },
    ];

    for (const p of sampleProducts) {
      const res = db.insert(products).values(p).returning().get();
      if (res && res.id) {
        db.insert(stockMovements)
          .values({
            productId: res.id,
            type: 'adjustment',
            quantity: p.quantity,
            balanceAfter: p.quantity,
            reason: 'رصيد مخزني افتتاحي متكامل للمقهى/المطعم',
            userId: 1,
            createdAt: now,
          })
          .run();
      }
    }
  }

  // 4. Seed sample customers if table is empty
  const existingCustomers = db.select().from(customers).limit(1).all();
  if (existingCustomers.length === 0) {
    db.insert(customers)
      .values([
        {
          name: 'مقهى الأندلس المركز الرئيسي',
          phone: '0912345678',
          address: 'طرابلس - النوفليين',
          tier: 'wholesale',
          creditLimit: 5000000, // 5,000.000 LYD
          creditBalance: 0,
          notes: 'عميل جملة منتظم',
          createdAt: now,
        },
        {
          name: 'مطعم وكافيه النخلة',
          phone: '0923456789',
          address: 'بنغازي - الكيش',
          tier: 'wholesale',
          creditLimit: 10000000, // 10,000.000 LYD
          creditBalance: 0,
          notes: 'حساب جملة رئيسي',
          createdAt: now,
        },
        {
          name: 'مقهى السرايا الحمراء',
          phone: '0945678901',
          address: 'طرابلس - المدينة القديمة',
          tier: 'retail',
          creditLimit: 2000000, // 2,000.000 LYD
          creditBalance: 0,
          notes: 'عميل قطاعي مع حد آجل',
          createdAt: now,
        },
      ])
      .run();
  }

  // 5. Seed sample suppliers if table is empty
  const existingSuppliers = db.select().from(suppliers).limit(1).all();
  if (existingSuppliers.length === 0) {
    db.insert(suppliers)
      .values([
        {
          name: 'شركة طرابلس لاستيراد البن ومستلزمات المقاهي',
          phone: '0910001122',
          address: 'طرابلس - طريق المطار',
          debtBalance: 0,
          notes: 'مورد البن الرئيسي والسيروب',
          createdAt: now,
        },
        {
          name: 'شركة المدار للمعدات الإيطالية وآلات القهوة',
          phone: '0920003344',
          address: 'مصراتة - شارع طرابلس',
          debtBalance: 0,
          notes: 'وكيل آلات الاسبريسو والمطاحن',
          createdAt: now,
        },
      ])
      .run();
  }

  return true;
}

// Run directly: npm run db:seed
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sqlite = openDatabase();
  runMigrations(sqlite);
  const inserted = seed(sqlite);
  console.log(inserted ? 'Seeded default settings, users, products, customers, and suppliers.' : 'Already seeded — nothing to do.');
  sqlite.close();
}

