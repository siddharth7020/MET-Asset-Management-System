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
router.get('/allquickinvoices', QuickInvoiceController.getAllQuickInvoices);
router.get('/allstock', StockStorageController.getAllStockStorage);
router.get('/alldistributions', DistributionController.getAllDistributions);
router.get('/allreturns', ReturnController.getAllReturns);

// GET by ID routes
router.get('/:poId', purchaseOrderController.getPurchaseOrderById);
router.get('/stock/:itemId', StockStorageController.getStockStorageByItemId);
router.get('/grn/:id', GRNController.getGRNById);
router.get('/invoices/:id', invoiceController.getInvoice);
router.get('/quick-grns/:id', QuickGRNController.getQuickGRNById);
router.get('/quick-invoices/:id', QuickInvoiceController.getQuickInvoiceById);
router.get('/distributions/:id', DistributionController.getDistributionById);
router.get('/returns/:id', ReturnController.getReturnById);

// POST create routes
router.post('/create', purchaseOrderController.createPurchaseOrder);
router.post('/:poId/creategrn', GRNController.createGRN);
router.post('/invoice/create', invoiceController.createInvoice);
router.post('/quick-grns', QuickGRNController.createQuickGRN);
router.post('/quickinvoice/create', QuickInvoiceController.createQuickInvoice);
router.post('/distribution/create', DistributionController.createDistribution);
router.post('/returns/create', ReturnController.createReturn);

// PUT update routes
router.put('/:poId', purchaseOrderController.updatePurchaseOrder);
router.put('/invoices/:id', invoiceController.updateInvoice);
router.put('/quick-invoices/:id', QuickInvoiceController.updateQuickInvoice);
router.put('/distributions/:id', DistributionController.updateDistribution);

// DELETE routes
router.delete('/:poId', purchaseOrderController.deletePurchaseOrder);

module.exports = router;
