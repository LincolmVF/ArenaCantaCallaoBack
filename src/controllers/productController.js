const prisma = require('../config/prisma');
const { serializeProduct } = require('../utils/pricing');

async function getOrCreatePricingConfig() {
  return prisma.pricingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      globalMarkupActive: false,
      globalMarkupPct: 10.0,
      label: 'Aumento Temporal General',
    },
  });
}

// Catálogo público para el Kiosco (solo activos y con stock > 0 opcionalmente, pero mostramos todos activos con indicador de stock)
async function getKioskProducts(req, res) {
  try {
    const { category, search } = req.query;
    const where = { isActive: true };

    if (category && category !== 'Todos') {
      where.category = String(category);
    }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { sku: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [products, pricingConfig] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      getOrCreatePricingConfig(),
    ]);

    return res.json({
      pricingConfig: {
        globalMarkupActive: pricingConfig.globalMarkupActive,
        globalMarkupPct: Number(pricingConfig.globalMarkupPct),
        label: pricingConfig.label,
      },
      products: products.map((p) => serializeProduct(p, pricingConfig)),
    });
  } catch (error) {
    console.error('Error al obtener catálogo kiosco:', error);
    return res.status(500).json({ error: 'Error al cargar el catálogo.' });
  }
}

// Listado completo para Admin
async function getAdminProducts(req, res) {
  try {
    const [products, pricingConfig] = await Promise.all([
      prisma.product.findMany({ orderBy: { id: 'asc' } }),
      getOrCreatePricingConfig(),
    ]);

    return res.json({
      pricingConfig: {
        globalMarkupActive: pricingConfig.globalMarkupActive,
        globalMarkupPct: Number(pricingConfig.globalMarkupPct),
        label: pricingConfig.label,
      },
      products: products.map((p) => serializeProduct(p, pricingConfig)),
    });
  } catch (error) {
    console.error('Error al obtener productos admin:', error);
    return res.status(500).json({ error: 'Error al obtener productos.' });
  }
}

async function createProduct(req, res) {
  try {
    const {
      sku,
      name,
      description,
      category,
      unit,
      basePrice,
      stock,
      emoji,
      imageUrl,
      isActive,
      overrideGlobalPrice,
      individualMarkupPct,
    } = req.body;

    if (!sku || !name || basePrice === undefined) {
      return res.status(400).json({ error: 'SKU, nombre y precio base son obligatorios.' });
    }

    const created = await prisma.product.create({
      data: {
        sku: String(sku).trim().toUpperCase(),
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        category: category ? String(category).trim() : 'Abarrotes',
        unit: unit ? String(unit).trim() : 'unidad',
        basePrice: Number(basePrice),
        stock: Number(stock || 0),
        emoji: emoji || '🛒',
        imageUrl: imageUrl || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        overrideGlobalPrice: Boolean(overrideGlobalPrice),
        individualMarkupPct: Number(individualMarkupPct || 0),
      },
    });

    const pricingConfig = await getOrCreatePricingConfig();
    return res.status(201).json({ product: serializeProduct(created, pricingConfig) });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un producto con ese SKU.' });
    }
    console.error('Error al crear producto:', error);
    return res.status(500).json({ error: 'Error al crear el producto.' });
  }
}

async function updateProduct(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de producto inválido.' });
    }

    const {
      sku,
      name,
      description,
      category,
      unit,
      basePrice,
      stock,
      emoji,
      imageUrl,
      isActive,
      overrideGlobalPrice,
      individualMarkupPct,
    } = req.body;

    const data = {};
    if (sku !== undefined) data.sku = String(sku).trim().toUpperCase();
    if (name !== undefined) data.name = String(name).trim();
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (category !== undefined) data.category = String(category).trim();
    if (unit !== undefined) data.unit = String(unit).trim();
    if (basePrice !== undefined) data.basePrice = Number(basePrice);
    if (stock !== undefined) data.stock = Number(stock);
    if (emoji !== undefined) data.emoji = emoji || '🛒';
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (overrideGlobalPrice !== undefined) data.overrideGlobalPrice = Boolean(overrideGlobalPrice);
    if (individualMarkupPct !== undefined) data.individualMarkupPct = Number(individualMarkupPct);

    const updated = await prisma.product.update({
      where: { id },
      data,
    });

    const pricingConfig = await getOrCreatePricingConfig();
    return res.json({ product: serializeProduct(updated, pricingConfig) });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'El SKU ya está en uso por otro producto.' });
    }
    console.error('Error al actualizar producto:', error);
    return res.status(500).json({ error: 'Error al actualizar el producto.' });
  }
}

async function deleteProduct(req, res) {
  try {
    const id = Number(req.params.id);
    await prisma.product.delete({ where: { id } });
    return res.json({ message: 'Producto eliminado correctamente.' });
  } catch (error) {
    if (error.code === 'P2003') {
      // Si tiene órdenes históricas asociadas, lo desactivamos en lugar de romper integridad referencial
      const id = Number(req.params.id);
      await prisma.product.update({ where: { id }, data: { isActive: false } });
      return res.json({
        message: 'El producto tiene ventas registradas, por lo que fue desactivado del catálogo.',
        softDeleted: true,
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    console.error('Error al eliminar producto:', error);
    return res.status(500).json({ error: 'Error al eliminar el producto.' });
  }
}

module.exports = {
  getOrCreatePricingConfig,
  getKioskProducts,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
