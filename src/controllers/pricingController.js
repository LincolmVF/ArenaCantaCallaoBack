const prisma = require('../config/prisma');
const { serializeProduct } = require('../utils/pricing');
const { getOrCreatePricingConfig } = require('./productController');

async function getPricingConfig(_req, res) {
  try {
    const config = await getOrCreatePricingConfig();
    return res.json({
      globalMarkupActive: config.globalMarkupActive,
      globalMarkupPct: Number(config.globalMarkupPct),
      label: config.label,
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error('Error al obtener configuración de precios:', error);
    return res.status(500).json({ error: 'Error al obtener configuración de precios.' });
  }
}

// Toggle / actualización de regla global temporal
async function updateGlobalPricing(req, res) {
  try {
    const { globalMarkupActive, globalMarkupPct, label } = req.body;

    const current = await getOrCreatePricingConfig();
    const updated = await prisma.pricingConfig.update({
      where: { id: current.id },
      data: {
        globalMarkupActive:
          globalMarkupActive !== undefined ? Boolean(globalMarkupActive) : current.globalMarkupActive,
        globalMarkupPct:
          globalMarkupPct !== undefined ? Number(globalMarkupPct) : current.globalMarkupPct,
        label: label !== undefined ? String(label).trim() : current.label,
      },
    });

    return res.json({
      message: updated.globalMarkupActive
        ? `Aumento global del ${Number(updated.globalMarkupPct)}% ACTIVADO`
        : 'Aumento global DESACTIVADO (precios base restaurados)',
      pricingConfig: {
        globalMarkupActive: updated.globalMarkupActive,
        globalMarkupPct: Number(updated.globalMarkupPct),
        label: updated.label,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error al actualizar regla global de precios:', error);
    return res.status(500).json({ error: 'Error al actualizar precios globales.' });
  }
}

// Regla individual por producto (sobresale de la regla global)
async function updateProductPricing(req, res) {
  try {
    const id = Number(req.params.id);
    const { overrideGlobalPrice, individualMarkupPct } = req.body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        overrideGlobalPrice: Boolean(overrideGlobalPrice),
        individualMarkupPct: Number(individualMarkupPct || 0),
      },
    });

    const config = await getOrCreatePricingConfig();
    return res.json({
      message: 'Regla de precio individual actualizada.',
      product: serializeProduct(updated, config),
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    console.error('Error al actualizar precio individual:', error);
    return res.status(500).json({ error: 'Error al actualizar precio individual.' });
  }
}

// Aplicar o quitar aumento porcentual por categoría
async function updateCategoryPricing(req, res) {
  try {
    const { category, overrideGlobalPrice, individualMarkupPct } = req.body;
    if (!category) {
      return res.status(400).json({ error: 'Debe especificar una categoría.' });
    }

    const active = Boolean(overrideGlobalPrice);
    const pct = active ? Number(individualMarkupPct || 0) : 0;

    const result = await prisma.product.updateMany({
      where: { category: String(category) },
      data: {
        overrideGlobalPrice: active,
        individualMarkupPct: pct,
      },
    });

    return res.json({
      message: active
        ? `Se aplicó ${pct >= 0 ? `+${pct}%` : `${pct}%`} a ${result.count} productos de "${category}".`
        : `Se quitó la regla individual de ${result.count} productos de "${category}".`,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error('Error al actualizar precios por categoría:', error);
    return res.status(500).json({ error: 'Error al actualizar precios por categoría.' });
  }
}

// Desactivar todas las reglas individuales de golpe
async function resetIndividualPricing(_req, res) {
  try {
    const result = await prisma.product.updateMany({
      where: { overrideGlobalPrice: true },
      data: {
        overrideGlobalPrice: false,
        individualMarkupPct: 0,
      },
    });

    return res.json({
      message: `Se desactivaron ${result.count} reglas individuales. Todos los productos siguen ahora la regla general.`,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error('Error al desactivar reglas individuales:', error);
    return res.status(500).json({ error: 'Error al desactivar reglas individuales.' });
  }
}

module.exports = {
  getPricingConfig,
  updateGlobalPricing,
  updateProductPricing,
  updateCategoryPricing,
  resetIndividualPricing,
};
