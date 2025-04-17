// routes/purchaseOrderRoutes.js
const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controller/purchase/poController');
const GRNController = require('../controller/purchase/grnController');
const DistributionController = require('../controller/distribution/DistributionController');
const StockStorageController = require('../controller/distribution/StockStograge');
const invoiceController = require('../controller/purchase/invoiceController'); // New import
const QuickGRNController = require('../controller/purchase/quickGRNController'); // New import
const QuickInvoiceController = require('../controller/purchase/quickInvoiceController'); // New import


router.post('/', purchaseOrderController.createPurchaseOrder);
router.get('/allpos', purchaseOrderController.getAllPurchaseOrders);
router.get('/:poId', purchaseOrderController.getPurchaseOrderById);
router.put('/:poId', purchaseOrderController.updatePurchaseOrder);
router.delete('/:poId', purchaseOrderController.deletePurchaseOrder);

router.post('/:poId/grn', GRNController.createGRN);
router.put('/:poId/grn/:grnId', GRNController.updateGRN); // New route
router.delete('/:poId/grn/:grnId', GRNController.deleteGRN); // New
router.get('/:poId/grn/:grnId', GRNController.getGRNById);   // New
router.get('/:poId/grn', GRNController.getAllGRNs);

router.post('/invoice/create', invoiceController.createInvoice);
router.get('/invoices/:id', invoiceController.getInvoice);
router.put('/invoiceupdate/:id', invoiceController.updateInvoice);
router.get('/po-details/:poId', invoiceController.getPODetailsForInvoice);

// New route for QuickGRN
router.post('/quickgrn/create', QuickGRNController.createQuickGRN); // New route
router.get('/quickgrn/all', QuickGRNController.getAllQuickGRNs); // New route
router.get('/quickgrn/:id', QuickGRNController.getQuickGRNById); // New route
router.put('/quickgrn/:id', QuickGRNController.updateQuickGRN); // New route
router.delete('/quickgrn/delete/:id', QuickGRNController.deleteQuickGRN); // New route

//quick invoice routes
router.post('/quickinvoice/create', QuickInvoiceController.createQuickInvoice); // New route
router.get('/quickinvoice/all', QuickInvoiceController.getAllQuickInvoices); // New route
router.get('/quickinvoice/:id', QuickInvoiceController.getQuickInvoiceById); // New route

router.post('/:poId/grn/:grnId/stock', StockStorageController.updateStockStorage);
router.get('/stock/item/:itemId', StockStorageController.getStockStorageByItemId);
router.get('/stock/item', StockStorageController.getAllStockStorage); // New route


router.post('/distribution', DistributionController.createDistribution); // New endpoint
router.get('/distribution/:id', DistributionController.getDistributionById); // New endpoint
router.delete('/distribution/:id', DistributionController.deleteDistribution); // New endpoint
router.get('/distributions', DistributionController.getAllDistributions); // New endpoint

module.exports = router;