// routes/purchaseOrderRoutes.js
const express = require('express');
const router = express.Router();

// Controllers
const purchaseOrderController = require('../controller/purchase/poController');
const GRNController = require('../controller/purchase/grnController');
const QuickGRNController = require('../controller/purchase/quickGRNController');
const invoiceController = require('../controller/purchase/invoiceController');
const QuickInvoiceController = require('../controller/purchase/quickInvoiceController');
const StockStorageController = require('../controller/distribution/StockStograge');
const DistributionController = require('../controller/distribution/DistributionController');
const ReturnController = require('../controller/distribution/ReturnController');

// GET all routes
router.get('/', purchaseOrderController.getAllPurchaseOrders);
router.get('/allgrns', GRNController.getAllGRNs);
router.get('/allinvoices', invoiceController.getAllInvoices);
router.get('/allquick-grns', QuickGRNController.getAllQuickGRNs);
router.get('/quick-invoices', QuickInvoiceController.getAllQuickInvoices);
router.get('/stock', StockStorageController.getAllStockStorage);
router.get('/distributions', DistributionController.getAllDistributions);
router.get('/distributions/:distributionId/returns', ReturnController.getAllReturns);

// GET by ID routes
router.get('/:poId', purchaseOrderController.getPurchaseOrderById);
router.get('/grn/:id', GRNController.getGRNById);
router.get('/invoices/:id', invoiceController.getInvoice);
router.get('/:poId/invoices', invoiceController.getPODetailsForInvoice);
router.get('/quick-grns/:id', QuickGRNController.getQuickGRNById);
router.get('/quick-invoices/:id', QuickInvoiceController.getQuickInvoiceById);
router.get('/stock/:itemId', StockStorageController.getStockStorageByItemId);
router.get('/distributions/:id', DistributionController.getDistributionById);
router.get('/distributions/:distributionId/returns/:returnId', ReturnController.getReturnById);

// POST create routes
router.post('/create', purchaseOrderController.createPurchaseOrder);
router.post('/:poId/creategrn', GRNController.createGRN);
router.post('/invoice/create', invoiceController.createInvoice);
router.post('/quick-grns', QuickGRNController.createQuickGRN);
router.post('/quick-invoices', QuickInvoiceController.createQuickInvoice);
router.post('/:poId/grns/:grnId/stock', StockStorageController.updateStockStorage);
router.post('/distributions', DistributionController.createDistribution);
router.post('/distributions/:distributionId/returns', ReturnController.createReturn);

// PUT update routes
router.put('/:poId', purchaseOrderController.updatePurchaseOrder);
router.put('/:poId/grns/:grnId', GRNController.updateGRN);
router.put('/invoices/:id', invoiceController.updateInvoice);
router.put('/quick-grns/:id', QuickGRNController.updateQuickGRN);
router.put('/quick-invoices/:id', QuickInvoiceController.updateQuickInvoice);
router.put('/distributions/:id', DistributionController.updateDistribution);

// DELETE routes
router.delete('/:poId', purchaseOrderController.deletePurchaseOrder);
router.delete('/:poId/grns/:grnId', GRNController.deleteGRN);
router.delete('/quick-grns/:id', QuickGRNController.deleteQuickGRN);

module.exports = router;
