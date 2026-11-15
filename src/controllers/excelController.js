const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const prisma = require('../config/prisma');

function parseBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return fallback;
}

function generateAutoSku(index) {
  const rand = Math.floor(100 + Math.random() * 900);
  const ts = Date.now().toString().slice(-4);
  return `ACC-${ts}${index}${rand}`;
}

// Descargar plantilla Excel (.xlsx) profesional con columnas obligatorias en AMARILLO e Instrucciones
async function downloadExcelTemplate(_req, res) {
  try {
    const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Arena Canta Callao CRM';
    workbook.created = new Date();

    // Hoja 1: Productos
    const sheet = workbook.addWorksheet('Productos');

    const columns = [
      { header: 'sku', key: 'sku', width: 14, required: false },
      { header: 'name', key: 'name', width: 34, required: true },
      { header: 'category', key: 'category', width: 18, required: true },
      { header: 'basePrice', key: 'basePrice', width: 14, required: true },
      { header: 'stock', key: 'stock', width: 12, required: true },
      { header: 'description', key: 'description', width: 34, required: false },
      { header: 'unit', key: 'unit', width: 14, required: false },
      { header: 'imageUrl', key: 'imageUrl', width: 42, required: false },
      { header: 'isActive', key: 'isActive', width: 12, required: false },
      { header: 'overrideGlobalPrice', key: 'overrideGlobalPrice', width: 22, required: false },
      { header: 'individualMarkupPct', key: 'individualMarkupPct', width: 22, required: false },
    ];

    sheet.columns = columns.map(({ header, key, width }) => ({ header, key, width }));

    // Estilo de encabezados: AMARILLO para obligatorios, gris pizarra para opcionales
    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.font = {
        bold: true,
        color: { argb: col.required ? 'FF0F172A' : 'FFFFFFFF' },
        size: 11,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: col.required ? 'FFFEF08A' : 'FF334155' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    const rowsData =
      products.length > 0
        ? products.map((p) => ({
            sku: p.sku,
            name: p.name,
            category: p.category,
            basePrice: Number(p.basePrice),
            stock: p.stock,
            description: p.description || '',
            unit: p.unit,
            imageUrl: p.imageUrl || '',
            isActive: p.isActive ? 'TRUE' : 'FALSE',
            overrideGlobalPrice: p.overrideGlobalPrice ? 'TRUE' : 'FALSE',
            individualMarkupPct: Number(p.individualMarkupPct),
          }))
        : [
            {
              sku: '',
              name: 'Arroz Costeño 1kg',
              category: 'Abarrotes',
              basePrice: 4.8,
              stock: 50,
              description: 'Opcional',
              unit: 'bolsa',
              imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80',
              isActive: 'TRUE',
              overrideGlobalPrice: 'FALSE',
              individualMarkupPct: 0,
            },
          ];

    rowsData.forEach((row) => sheet.addRow(row));

    // Hoja 2: Instrucciones claras
    const infoSheet = workbook.addWorksheet('Instrucciones');
    infoSheet.columns = [
      { header: 'Columna', key: 'col', width: 24 },
      { header: 'Obligatorio', key: 'req', width: 18 },
      { header: 'Valor por Defecto', key: 'def', width: 24 },
      { header: 'Descripción e Indicaciones', key: 'desc', width: 65 },
    ];

    const infoHeader = infoSheet.getRow(1);
    infoHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    infoHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    const instructions = [
      { col: 'name', req: 'SÍ (AMARILLO)', def: 'N/A', desc: 'Nombre del producto visible en el Kiosco y Admin.' },
      { col: 'category', req: 'SÍ (AMARILLO)', def: 'N/A', desc: 'Categoría del producto (ej. Abarrotes, Bebidas, Lácteos, Limpieza).' },
      { col: 'basePrice', req: 'SÍ (AMARILLO)', def: 'N/A', desc: 'Precio base en soles usando punto decimal (ej. 4.80).' },
      { col: 'stock', req: 'SÍ (AMARILLO)', def: 'N/A', desc: 'Cantidad disponible en inventario (número entero >= 0).' },
      { col: 'sku', req: 'Opcional', def: 'Autogenerado', desc: 'Código único del producto. Si se deja vacío se genera uno automáticamente. Si coincide con uno existente, lo actualiza.' },
      { col: 'description', req: 'Opcional', def: 'Vacío', desc: 'Descripción breve del producto.' },
      { col: 'unit', req: 'Opcional', def: 'unidad', desc: 'Unidad de medida (ej. bolsa, botella, lata, kg).' },
      { col: 'imageUrl', req: 'Opcional', def: 'Vacío', desc: 'Link directo (URL https://...) de la imagen del producto para mostrar en el Kiosco.' },
      { col: 'isActive', req: 'Opcional', def: 'TRUE', desc: 'TRUE para mostrar en el Kiosco, FALSE para ocultarlo.' },
      { col: 'overrideGlobalPrice', req: 'Opcional', def: 'FALSE', desc: 'TRUE si este producto ignora la regla global de precios.' },
      { col: 'individualMarkupPct', req: 'Opcional', def: '0', desc: 'Porcentaje de aumento/descuento individual si overrideGlobalPrice es TRUE.' },
    ];

    instructions.forEach((item) => {
      const r = infoSheet.addRow(item);
      if (item.req.startsWith('SÍ')) {
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
        r.getCell(2).font = { bold: true, color: { argb: 'FFB45309' } };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla_inventario_arena_canta_callao.xlsx"'
    );
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error al generar plantilla Excel:', error);
    return res.status(500).json({ error: 'No se pudo generar la plantilla Excel.' });
  }
}

// Carga masiva desde archivo .xlsx o .csv
// Solo son obligatorios: name, category, basePrice, stock. El resto toma valores por defecto.
async function bulkUploadExcel(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debe adjuntar un archivo .xlsx o .csv.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames.find((s) => s !== 'Instrucciones') || workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ error: 'El archivo no contiene hojas válidas.' });
    }

    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      defval: '',
    });

    if (!rawRows.length) {
      return res.status(400).json({ error: 'La hoja de cálculo está vacía.' });
    }

    const validItems = [];
    const errors = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;
      const name = String(row.name || row.nombre || row.Nombre || '').trim();
      const category = String(row.category || row.categoria || row.Categoria || '').trim();
      const rawPrice = row.basePrice ?? row.precioBase ?? row.precio ?? row.Precio;
      const rawStock = row.stock ?? row.Stock;

      if (!name || !category || rawPrice === '' || rawPrice === undefined || rawStock === '' || rawStock === undefined) {
        errors.push(`Fila ${rowNum}: faltan columnas obligatorias en amarillo (name, category, basePrice, stock).`);
        return;
      }

      const basePrice = Number(rawPrice);
      const stock = Number(rawStock);
      const individualMarkupPct = Number(row.individualMarkupPct || 0);

      if (Number.isNaN(basePrice) || basePrice < 0) {
        errors.push(`Fila ${rowNum} (${name}): basePrice inválido.`);
        return;
      }
      if (Number.isNaN(stock) || stock < 0) {
        errors.push(`Fila ${rowNum} (${name}): stock inválido.`);
        return;
      }

      const rawSku = String(row.sku || row.SKU || '').trim().toUpperCase();
      const sku = rawSku || generateAutoSku(index);

      validItems.push({
        sku,
        name,
        category,
        basePrice,
        stock: Math.floor(stock),
        description: row.description ? String(row.description).trim() : null,
        unit: String(row.unit || row.unidad || 'unidad').trim() || 'unidad',
        imageUrl: row.imageUrl ? String(row.imageUrl).trim() : null,
        isActive: row.isActive === '' || row.isActive === undefined ? true : parseBool(row.isActive, true),
        overrideGlobalPrice: row.overrideGlobalPrice === '' || row.overrideGlobalPrice === undefined ? false : parseBool(row.overrideGlobalPrice, false),
        individualMarkupPct: Number.isNaN(individualMarkupPct) ? 0 : individualMarkupPct,
      });
    });

    if (!validItems.length) {
      return res.status(400).json({
        error: 'No se encontraron filas válidas. Verifica las 4 columnas obligatorias (name, category, basePrice, stock).',
        errors,
      });
    }

    const existingSkus = new Set(
      (
        await prisma.product.findMany({
          where: { sku: { in: validItems.map((i) => i.sku) } },
          select: { sku: true },
        })
      ).map((p) => p.sku)
    );

    await prisma.$transaction(
      validItems.map((item) =>
        prisma.product.upsert({
          where: { sku: item.sku },
          update: {
            name: item.name,
            description: item.description,
            category: item.category,
            unit: item.unit,
            basePrice: item.basePrice,
            stock: item.stock,
            imageUrl: item.imageUrl,
            isActive: item.isActive,
            overrideGlobalPrice: item.overrideGlobalPrice,
            individualMarkupPct: item.individualMarkupPct,
          },
          create: item,
        })
      )
    );

    const updatedCount = validItems.filter((i) => existingSkus.has(i.sku)).length;
    const createdCount = validItems.length - updatedCount;

    return res.json({
      message: 'Carga masiva procesada correctamente.',
      summary: {
        totalProcessed: validItems.length,
        created: createdCount,
        updated: updatedCount,
        skippedWithErrors: errors.length,
      },
      errors,
    });
  } catch (error) {
    console.error('Error en carga masiva Excel:', error);
    return res.status(500).json({ error: 'Error al procesar el archivo Excel.' });
  }
}

module.exports = {
  downloadExcelTemplate,
  bulkUploadExcel,
};
