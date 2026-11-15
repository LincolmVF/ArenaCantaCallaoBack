require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de Arena Canta Callao (ArenaCC)...');

  // 1. Usuarios iniciales (Admin y Cliente)
  const adminHash = await bcrypt.hash('AdminArena2026!', 10);
  const clienteHash = await bcrypt.hash('ClienteArena2026!', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminHash, role: 'ADMIN', fullName: 'Administrador Arena CC', isActive: true },
    create: {
      username: 'admin',
      passwordHash: adminHash,
      fullName: 'Administrador Arena CC',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const clienteUser = await prisma.user.upsert({
    where: { username: 'cliente' },
    update: { passwordHash: clienteHash, role: 'CLIENTE', fullName: 'Cliente Kiosco', isActive: true },
    create: {
      username: 'cliente',
      passwordHash: clienteHash,
      fullName: 'Cliente Kiosco',
      role: 'CLIENTE',
      isActive: true,
    },
  });

  // 2. Configuración global de precios dinámicos
  await prisma.pricingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      globalMarkupActive: false,
      globalMarkupPct: 10.0,
      label: 'Aumento Temporal por Alta Demanda',
    },
  });

  // 3. Catálogo inicial de víveres con imágenes reales (URLs)
  const productsData = [
    {
      sku: 'ACC-001',
      name: 'Arroz Extra Costeño 1kg',
      description: 'Arroz superior grano largo bolsa 1kg',
      category: 'Abarrotes',
      unit: 'bolsa',
      basePrice: 4.80,
      stock: 80,
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-002',
      name: 'Aceite Vegetal Primor 1L',
      description: 'Aceite vegetal clásico botella 1 litro',
      category: 'Abarrotes',
      unit: 'botella',
      basePrice: 9.50,
      stock: 45,
      imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-003',
      name: 'Leche Evaporada Gloria 400g',
      description: 'Leche evaporada entera etiqueta azul',
      category: 'Lácteos',
      unit: 'lata',
      basePrice: 4.20,
      stock: 120,
      imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-004',
      name: 'Azúcar Rubia Cartavio 1kg',
      description: 'Azúcar rubia doméstica bolsa 1kg',
      category: 'Abarrotes',
      unit: 'bolsa',
      basePrice: 4.30,
      stock: 65,
      imageUrl: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-005',
      name: 'Fideos Spaghetti Don Vittorio 500g',
      description: 'Pasta larga de sémola de trigo',
      category: 'Abarrotes',
      unit: 'paquete',
      basePrice: 3.60,
      stock: 70,
      imageUrl: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-006',
      name: 'Filete de Atún Florida 170g',
      description: 'Filete de atún en aceite vegetal',
      category: 'Conservas',
      unit: 'lata',
      basePrice: 6.20,
      stock: 55,
      imageUrl: 'https://images.unsplash.com/photo-1534943441045-1009d7cb0bb9?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-007',
      name: 'Huevos Pardos x 15 unid.',
      description: 'Jaba de 15 huevos frescos seleccionados',
      category: 'Frescos',
      unit: 'jaba',
      basePrice: 10.50,
      stock: 30,
      imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-008',
      name: 'Agua Mineral San Mateo 2.5L',
      description: 'Agua de manantial sin gas 2.5 litros',
      category: 'Bebidas',
      unit: 'botella',
      basePrice: 3.50,
      stock: 90,
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-009',
      name: 'Gaseosa Inca Kola 1.5L',
      description: 'Bebida gasificada sabor nacional 1.5L',
      category: 'Bebidas',
      unit: 'botella',
      basePrice: 7.50,
      stock: 50,
      imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-010',
      name: 'Pan de Molde Blanco Bimbo',
      description: 'Pan de molde grande sin bordes 480g',
      category: 'Panadería',
      unit: 'bolsa',
      basePrice: 8.90,
      stock: 25,
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-011',
      name: 'Café Instantáneo Nescafé 50g',
      description: 'Frasco de café soluble tradición',
      category: 'Desayunos',
      unit: 'frasco',
      basePrice: 11.90,
      stock: 35,
      imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=500&q=80',
    },
    {
      sku: 'ACC-012',
      name: 'Detergente Bolívar Floral 1kg',
      description: 'Detergente en polvo limpieza profunda',
      category: 'Limpieza',
      unit: 'bolsa',
      basePrice: 11.20,
      stock: 40,
      imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=500&q=80',
    },
  ];

  const savedProducts = [];
  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { imageUrl: p.imageUrl },
      create: p,
    });
    savedProducts.push(prod);
  }

  // 4. Histórico de ventas de 2 meses (60 días) para Dashboard y Reportes
  await prisma.order.deleteMany({
    where: { orderNumber: { startsWith: 'ACC-HIST-' } },
  });

  const now = new Date();
  let orderCounter = 1;

  for (let daysAgo = 59; daysAgo >= 0; daysAgo--) {
    // Entre 1 y 3 órdenes por día (más los fines de semana o días recientes)
    const ordersToday = daysAgo === 0 ? 3 : (daysAgo % 3 === 0 ? 2 : 1);

    for (let j = 0; j < ordersToday; j++) {
      const orderDate = new Date(now);
      orderDate.setDate(now.getDate() - daysAgo);
      orderDate.setHours(9 + ((orderCounter * 2) % 11), (orderCounter * 17) % 60, 0, 0);
      if (orderDate > now) {
        orderDate.setTime(now.getTime() - (j + 1) * 15 * 60 * 1000);
      }

      // Seleccionar entre 2 y 4 productos por orden
      const numItems = 2 + (orderCounter % 3);
      const itemsToCreate = [];
      let totalAmount = 0;

      for (let k = 0; k < numItems; k++) {
        const prod = savedProducts[(orderCounter + k * 3) % savedProducts.length];
        const qty = 1 + ((orderCounter + k) % 3);
        const unitPrice = Number(prod.basePrice);
        const subtotal = Number((unitPrice * qty).toFixed(2));
        totalAmount = Number((totalAmount + subtotal).toFixed(2));

        itemsToCreate.push({
          productId: prod.id,
          productName: prod.name,
          quantity: qty,
          basePriceSnapshot: unitPrice,
          unitPriceApplied: unitPrice,
          pricingRuleUsed: 'BASE',
          subtotal,
        });
      }

      const orderNumber = `ACC-HIST-${String(orderCounter).padStart(4, '0')}`;
      await prisma.order.create({
        data: {
          orderNumber,
          customerName: orderCounter % 4 === 0 ? 'Cliente Kiosco' : `Cliente #${100 + orderCounter}`,
          totalAmount,
          paymentMethod: 'QR_MOCK',
          status: 'COMPLETED',
          userId: orderCounter % 4 === 0 ? clienteUser.id : null,
          createdAt: orderDate,
          items: {
            create: itemsToCreate,
          },
        },
      });

      orderCounter++;
    }
  }

  console.log(`✅ Seed completado: ${savedProducts.length} productos y ${orderCounter - 1} órdenes históricas (60 días).`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
