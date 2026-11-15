/**
 * Calcula el precio efectivo de un producto aplicando el Motor de Precios Dinámicos.
 * Prioridad:
 * 1. Si product.overrideGlobalPrice === true -> aplica individualMarkupPct sobre basePrice (sobresale de la regla global).
 * 2. Si pricingConfig.globalMarkupActive === true -> aplica globalMarkupPct sobre basePrice.
 * 3. Caso contrario -> devuelve basePrice.
 */
function calculateEffectivePrice(product, pricingConfig) {
  const basePrice = Number(product.basePrice);
  const individualPct = Number(product.individualMarkupPct || 0);
  const globalActive = Boolean(pricingConfig?.globalMarkupActive);
  const globalPct = Number(pricingConfig?.globalMarkupPct || 0);

  let effectivePrice = basePrice;
  let activeRule = 'BASE';
  let appliedPct = 0;

  if (product.overrideGlobalPrice) {
    effectivePrice = basePrice * (1 + individualPct / 100);
    activeRule = 'INDIVIDUAL';
    appliedPct = individualPct;
  } else if (globalActive) {
    effectivePrice = basePrice * (1 + globalPct / 100);
    activeRule = 'GLOBAL';
    appliedPct = globalPct;
  }

  return {
    basePrice: Number(basePrice.toFixed(2)),
    effectivePrice: Number(effectivePrice.toFixed(2)),
    activeRule,
    appliedPct: Number(appliedPct.toFixed(2)),
  };
}

function serializeProduct(product, pricingConfig) {
  const pricing = calculateEffectivePrice(product, pricingConfig);
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    unit: product.unit,
    stock: product.stock,
    imageUrl: product.imageUrl || '',
    isActive: product.isActive,
    overrideGlobalPrice: product.overrideGlobalPrice,
    individualMarkupPct: Number(product.individualMarkupPct || 0),
    basePrice: pricing.basePrice,
    effectivePrice: pricing.effectivePrice,
    activeRule: pricing.activeRule,
    appliedPct: pricing.appliedPct,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

module.exports = {
  calculateEffectivePrice,
  serializeProduct,
};
