const express = require('express');
const multer = require('multer');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middlewares/auth');
const authController = require('../controllers/authController');
const productController = require('../controllers/productController');
const pricingController = require('../controllers/pricingController');
const excelController = require('../controllers/excelController');
const orderController = require('../controllers/orderController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Formato no soportado. Use .xlsx o .csv.'));
    }
  },
});

// Salud del servicio
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Arena Canta Callao API' });
});

// Autenticación
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getProfile);

// Módulo 1: Kiosco de Autoservicio (Público / Cliente)
router.get('/kiosk/products', productController.getKioskProducts);
router.post('/orders', optionalAuth, orderController.createOrder);

// Módulo 2: Panel Admin / CRM (Protegido para ADMIN)
router.get('/admin/products', authenticateToken, requireAdmin, productController.getAdminProducts);
router.post('/admin/products', authenticateToken, requireAdmin, productController.createProduct);
router.put('/admin/products/:id', authenticateToken, requireAdmin, productController.updateProduct);
router.delete('/admin/products/:id', authenticateToken, requireAdmin, productController.deleteProduct);

// Motor de Precios Dinámicos
router.get('/admin/pricing', authenticateToken, requireAdmin, pricingController.getPricingConfig);
router.put('/admin/pricing/global', authenticateToken, requireAdmin, pricingController.updateGlobalPricing);
router.put('/admin/pricing/category', authenticateToken, requireAdmin, pricingController.updateCategoryPricing);
router.put('/admin/pricing/product/:id', authenticateToken, requireAdmin, pricingController.updateProductPricing);
router.put('/admin/pricing/reset-individuals', authenticateToken, requireAdmin, pricingController.resetIndividualPricing);

// Carga Masiva Excel
router.get('/admin/products/excel/template', authenticateToken, requireAdmin, excelController.downloadExcelTemplate);
router.post(
  '/admin/products/excel/upload',
  authenticateToken,
  requireAdmin,
  upload.single('file'),
  excelController.bulkUploadExcel
);

// Reportes de Ventas (Filtros dinámicos + Exportar Excel)
router.get('/admin/reports/sales', authenticateToken, requireAdmin, orderController.getSalesReport);
router.get('/admin/reports/sales/excel', authenticateToken, requireAdmin, orderController.exportSalesReportExcel);

// Asientos / Movimientos de Compras (Visibilidad, Edición y Reversión)
router.get('/admin/orders', authenticateToken, requireAdmin, orderController.getAdminOrders);
router.put('/admin/orders/:id', authenticateToken, requireAdmin, orderController.updateAdminOrder);
router.post('/admin/orders/:id/revert', authenticateToken, requireAdmin, orderController.revertAdminOrder);

module.exports = router;
