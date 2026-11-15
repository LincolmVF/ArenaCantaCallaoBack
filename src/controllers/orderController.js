const ExcelJS = require('exceljs');
const prisma = require('../config/prisma');
const { calculateEffectivePrice } = require('../utils/pricing');
const { getOrCreatePricingConfig } = require('./productController');

function generateOrderNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `ACC-${datePart}-${randomPart}`;
}

async function createOrder(req, res) {
  try {
    const { items, customerName, paymentMethod } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito no puede estar vacío.' });
    }

    const pricingConfig = await getOrCreatePricingConfig();
    const productIds = items.map((i) => Number(i.productId));

    const orderResult = await prisma.$transaction(async (tx) => {
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true },
      });

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));
      let totalAmount = 0;
      const orderItemsData = [];

      for (const item of items) {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);

        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error(`Cantidad inválida para producto ID ${productId}`);
        }

        const product = productMap.get(productId);
        if (!product) {
          throw new Error(`Producto ID ${productId} no disponible.`);
        }

        if (product.stock < quantity) {
          throw new Error(
            `Stock insuficiente para "${product.name}". Disponible: ${product.stock}`
          );
        }

        const pricing = calculateEffectivePrice(product, pricingConfig);
        const subtotal = Number((pricing.effectivePrice * quantity).toFixed(2));
        totalAmount = Number((totalAmount + subtotal).toFixed(2));

        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: quantity } },
        });

        orderItemsData.push({
          productId: product.id,
          productName: product.name,
          quantity,
          basePriceSnapshot: pricing.basePrice,
          unitPriceApplied: pricing.effectivePrice,
          pricingRuleUsed: pricing.activeRule,
          subtotal,
        });
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerName: customerName ? String(customerName).trim() : 'Kiosco Tablet',
          totalAmount,
          paymentMethod: paymentMethod || 'QR_MOCK',
          status: 'COMPLETED',
          userId: req.user?.id || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      return createdOrder;
    });

    return res.status(201).json({
      message: 'Venta registrada con éxito.',
      order: {
        ...orderResult,
        totalAmount: Number(orderResult.totalAmount),
        items: orderResult.items.map((item) => ({
          ...item,
          basePriceSnapshot: Number(item.basePriceSnapshot),
          unitPriceApplied: Number(item.unitPriceApplied),
          subtotal: Number(item.subtotal),
        })),
      },
    });
  } catch (error) {
    console.error('Error al registrar orden:', error);
    return res.status(400).json({ error: error.message || 'No se pudo procesar la orden.' });
  }
}

function getIsoWeekRange(weekStr) {
  // Formato esperado: YYYY-Www (ej. 2026-W46)
  const [yearPart, weekPart] = String(weekStr).split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);
  if (!year || !week) return null;

  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - jan4Day + 1);

  const start = new Date(mondayOfWeek1);
  start.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function resolveDateRange(query) {
  const mode = String(query.mode || query.period || 'day').toLowerCase();
  const now = new Date();

  if (mode === 'all') {
    return { mode: 'all', label: 'Todo el Histórico', startDate: null, endDate: null };
  }

  if (mode === 'day' || mode === 'daily') {
    const target = query.date ? new Date(`${query.date}T00:00:00`) : new Date(now);
    const startDate = new Date(target);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(target);
    endDate.setHours(23, 59, 59, 999);
    return {
      mode: 'day',
      label: `Día ${startDate.toLocaleDateString('es-PE')}`,
      startDate,
      endDate,
    };
  }

  if (mode === 'week' || mode === 'weekly') {
    if (query.week) {
      const range = getIsoWeekRange(query.week);
      if (range) {
        return {
          mode: 'week',
          label: `Semana ${query.week} (${range.start.toLocaleDateString('es-PE')} - ${range.end.toLocaleDateString('es-PE')})`,
          startDate: range.start,
          endDate: range.end,
        };
      }
    }
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    return { mode: 'week', label: 'Últimos 7 días', startDate, endDate };
  }

  if (mode === 'month' || mode === 'monthly') {
    let year = now.getFullYear();
    let monthIdx = now.getMonth();
    if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
      const [y, m] = query.month.split('-').map(Number);
      year = y;
      monthIdx = m - 1;
    }
    const startDate = new Date(year, monthIdx, 1, 0, 0, 0, 0);
    const endDate = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
    return {
      mode: 'month',
      label: `Mes ${String(monthIdx + 1).padStart(2, '0')}/${year}`,
      startDate,
      endDate,
    };
  }

  if (mode === 'custom' && query.from && query.to) {
    const startDate = new Date(`${query.from}T00:00:00`);
    const endDate = new Date(`${query.to}T23:59:59`);
    return {
      mode: 'custom',
      label: `Del ${startDate.toLocaleDateString('es-PE')} al ${endDate.toLocaleDateString('es-PE')}`,
      startDate,
      endDate,
    };
  }

  // Fallback últimos 60 días
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 60);
  startDate.setHours(0, 0, 0, 0);
  return { mode: 'bimonthly', label: 'Últimos 60 días', startDate, endDate: now };
}

async function fetchSalesReportData(query) {
  const { mode, label, startDate, endDate } = resolveDateRange(query);

  const where = {
    status: { in: ['PAID', 'COMPLETED'] },
  };
  if (startDate && endDate) {
    where.createdAt = { gte: startDate, lte: endDate };
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  let totalRevenue = 0;
  let totalItemsSold = 0;
  const productStatsMap = new Map();

  for (const order of orders) {
    totalRevenue += Number(order.totalAmount);
    for (const item of order.items) {
      totalItemsSold += item.quantity;
      const current = productStatsMap.get(item.productName) || {
        productName: item.productName,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue = Number((current.revenue + Number(item.subtotal)).toFixed(2));
      productStatsMap.set(item.productName, current);
    }
  }

  const topProducts = Array.from(productStatsMap.values()).sort(
    (a, b) => b.quantity - a.quantity || b.revenue - a.revenue
  );

  return {
    mode,
    label,
    range: {
      from: startDate ? startDate.toISOString() : null,
      to: endDate ? endDate.toISOString() : null,
    },
    summary: {
      totalOrders: orders.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalItemsSold,
      averageTicket: orders.length > 0 ? Number((totalRevenue / orders.length).toFixed(2)) : 0,
    },
    topProducts,
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      totalAmount: Number(o.totalAmount),
      paymentMethod: o.paymentMethod,
      status: o.status,
      createdAt: o.createdAt,
      itemsCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
      items: o.items.map((it) => ({
        id: it.id,
        productName: it.productName,
        quantity: it.quantity,
        unitPriceApplied: Number(it.unitPriceApplied),
        pricingRuleUsed: it.pricingRuleUsed,
        subtotal: Number(it.subtotal),
      })),
    })),
  };
}

async function getSalesReport(req, res) {
  try {
    const report = await fetchSalesReportData(req.query);
    return res.json(report);
  } catch (error) {
    console.error('Error al generar reporte de ventas:', error);
    return res.status(500).json({ error: 'Error al generar el reporte de ventas.' });
  }
}

async function exportSalesReportExcel(req, res) {
  try {
    const report = await fetchSalesReportData(req.query);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Arena Canta Callao CRM';
    workbook.created = new Date();

    // Hoja 1: Productos Más Vendidos
    const topSheet = workbook.addWorksheet('Mas Vendidos');
    topSheet.columns = [
      { header: 'Ranking', key: 'rank', width: 10 },
      { header: 'Producto', key: 'productName', width: 38 },
      { header: 'Unidades Vendidas', key: 'quantity', width: 20 },
      { header: 'Ingresos Totales (S/)', key: 'revenue', width: 22 },
    ];
    const topHeader = topSheet.getRow(1);
    topHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    topHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    report.topProducts.forEach((tp, idx) => {
      topSheet.addRow({
        rank: idx + 1,
        productName: tp.productName,
        quantity: tp.quantity,
        revenue: tp.revenue,
      });
    });

    // Hoja 2: Resumen
    const summarySheet = workbook.addWorksheet('Resumen');
    summarySheet.columns = [
      { header: 'Indicador', key: 'metric', width: 28 },
      { header: 'Valor', key: 'value', width: 32 },
    ];
    const sumHeader = summarySheet.getRow(1);
    sumHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

    summarySheet.addRow({ metric: 'Periodo del Reporte', value: report.label });
    summarySheet.addRow({ metric: 'Ingresos Totales (S/)', value: report.summary.totalRevenue });
    summarySheet.addRow({ metric: 'Órdenes Completadas', value: report.summary.totalOrders });
    summarySheet.addRow({ metric: 'Total Ítems Vendidos', value: report.summary.totalItemsSold });
    summarySheet.addRow({ metric: 'Ticket Promedio (S/)', value: report.summary.averageTicket });

    // Hoja 3: Detalle de Órdenes (sin columna Cliente)
    const ordersSheet = workbook.addWorksheet('Ordenes');
    ordersSheet.columns = [
      { header: 'N° Orden', key: 'orderNumber', width: 20 },
      { header: 'Fecha y Hora', key: 'createdAt', width: 24 },
      { header: 'Ítems', key: 'itemsCount', width: 12 },
      { header: 'Método de Pago', key: 'paymentMethod', width: 18 },
      { header: 'Total (S/)', key: 'totalAmount', width: 16 },
    ];
    const ordHeader = ordersSheet.getRow(1);
    ordHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ordHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    report.orders.forEach((o) => {
      ordersSheet.addRow({
        orderNumber: o.orderNumber,
        createdAt: new Date(o.createdAt).toLocaleString('es-PE'),
        itemsCount: o.itemsCount,
        paymentMethod: o.paymentMethod,
        totalAmount: o.totalAmount,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte_ventas_arena_canta_callao.xlsx"`
    );
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error al exportar Excel de ventas:', error);
    return res.status(500).json({ error: 'Error al exportar el reporte en Excel.' });
  }
}

// Admin: Listar todos los asientos / movimientos de compras
async function getAdminOrders(req, res) {
  try {
    const { status, search } = req.query;
    const where = {};

    if (status && status !== 'ALL') {
      where.status = String(status).toUpperCase();
    }
    if (search && String(search).trim()) {
      where.orderNumber = { contains: String(search).trim(), mode: 'insensitive' };
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: Number(o.totalAmount),
        paymentMethod: o.paymentMethod,
        status: o.status,
        createdAt: o.createdAt,
        itemsCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
        items: o.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          basePriceSnapshot: Number(it.basePriceSnapshot),
          unitPriceApplied: Number(it.unitPriceApplied),
          pricingRuleUsed: it.pricingRuleUsed,
          subtotal: Number(it.subtotal),
        })),
      })),
    });
  } catch (error) {
    console.error('Error al listar asientos/movimientos:', error);
    return res.status(500).json({ error: 'Error al obtener los movimientos.' });
  }
}

// Admin: Editar un movimiento (método de pago o cantidades, ajustando stock automáticamente)
async function updateAdminOrder(req, res) {
  try {
    const id = Number(req.params.id);
    const { paymentMethod, items } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de orden inválido.' });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        throw new Error('Movimiento no encontrado.');
      }
      if (existing.status === 'CANCELLED') {
        throw new Error('No se puede editar un movimiento que ya fue revertido/anulado.');
      }

      let newTotal = Number(existing.totalAmount);

      if (Array.isArray(items)) {
        if (items.length === 0) {
          throw new Error('El movimiento debe tener al menos un producto. Si deseas anularlo, usa "Revertir".');
        }

        const oldQtyMap = new Map(existing.items.map((it) => [it.productId, it]));
        const newItemsData = [];
        newTotal = 0;

        for (const incoming of items) {
          const productId = Number(incoming.productId);
          const newQty = Number(incoming.quantity);

          if (!Number.isInteger(newQty) || newQty <= 0) {
            throw new Error('Las cantidades deben ser enteros mayores a 0.');
          }

          const oldItem = oldQtyMap.get(productId);
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) {
            throw new Error(`Producto ID ${productId} no existe.`);
          }

          const oldQty = oldItem ? oldItem.quantity : 0;
          const diff = newQty - oldQty; // >0 consume más stock, <0 devuelve stock

          if (diff > 0) {
            if (product.stock < diff) {
              throw new Error(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}`);
            }
            await tx.product.update({
              where: { id: productId },
              data: { stock: { decrement: diff } },
            });
          } else if (diff < 0) {
            await tx.product.update({
              where: { id: productId },
              data: { stock: { increment: Math.abs(diff) } },
            });
          }

          const unitPrice = oldItem
            ? Number(oldItem.unitPriceApplied)
            : Number(product.basePrice);
          const baseSnapshot = oldItem
            ? Number(oldItem.basePriceSnapshot)
            : Number(product.basePrice);
          const subtotal = Number((unitPrice * newQty).toFixed(2));
          newTotal = Number((newTotal + subtotal).toFixed(2));

          newItemsData.push({
            productId,
            productName: oldItem ? oldItem.productName : product.name,
            quantity: newQty,
            basePriceSnapshot: baseSnapshot,
            unitPriceApplied: unitPrice,
            pricingRuleUsed: oldItem ? oldItem.pricingRuleUsed : 'BASE',
            subtotal,
          });

          oldQtyMap.delete(productId);
        }

        // Productos removidos del movimiento devuelven su stock completo
        for (const removedItem of oldQtyMap.values()) {
          await tx.product.update({
            where: { id: removedItem.productId },
            data: { stock: { increment: removedItem.quantity } },
          });
        }

        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({
          data: newItemsData.map((d) => ({ ...d, orderId: id })),
        });
      }

      return tx.order.update({
        where: { id },
        data: {
          paymentMethod: paymentMethod ? String(paymentMethod).trim() : existing.paymentMethod,
          totalAmount: newTotal,
        },
        include: { items: true },
      });
    });

    return res.json({
      message: `Movimiento ${updatedOrder.orderNumber} actualizado y stock conciliado.`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Error al editar movimiento:', error);
    return res.status(400).json({ error: error.message || 'No se pudo editar el movimiento.' });
  }
}

// Admin: Revertir / Anular un movimiento devolviendo el stock al inventario
async function revertAdminOrder(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de orden inválido.' });
    }

    const reverted = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        throw new Error('Movimiento no encontrado.');
      }
      if (existing.status === 'CANCELLED') {
        throw new Error('Este movimiento ya fue revertido anteriormente.');
      }

      // Devolver stock de cada ítem al inventario
      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      return tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });

    return res.json({
      message: `Movimiento ${reverted.orderNumber} revertido. El stock fue devuelto al inventario.`,
      order: reverted,
    });
  } catch (error) {
    console.error('Error al revertir movimiento:', error);
    return res.status(400).json({ error: error.message || 'No se pudo revertir el movimiento.' });
  }
}

module.exports = {
  createOrder,
  getSalesReport,
  exportSalesReportExcel,
  getAdminOrders,
  updateAdminOrder,
  revertAdminOrder,
};
