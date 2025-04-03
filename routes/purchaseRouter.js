// routes/purchaseOrderRoutes.js
const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controller/purchase/poController');
const GRNController = require('../controller/purchase/grnController');
const DistributionController = require('../controller/distribution/DistributionController');
const StockStorageController = require('../controller/distribution/StockStograge');
const invoiceController = require('../controller/purchase/invoiceController'); // New import


router.post('/', purchaseOrderController.createPurchaseOrder);
router.get('/', purchaseOrderController.getAllPurchaseOrders);
router.get('/:poId', purchaseOrderController.getPurchaseOrderById);
router.put('/:poId', purchaseOrderController.updatePurchaseOrder);
router.delete('/:poId', purchaseOrderController.deletePurchaseOrder);

router.post('/:poId/grn', GRNController.createGRN);
router.put('/:poId/grn/:grnId', GRNController.updateGRN); // New route
router.delete('/:poId/grn/:grnId', GRNController.deleteGRN); // New
router.get('/:poId/grn/:grnId', GRNController.getGRNById);   // New
router.get('/:poId/grn', GRNController.getAllGRNs);

// // Create a new invoice
// router.post('/invoice/create', invoiceController.createInvoice);

// // Get all invoices
// router.get('/invoices/', invoiceController.getAllInvoices);

// // Get a specific invoice by ID
// router.get('/invoice/:id', invoiceController.getInvoiceById);

// // Update an invoice
// router.put('/invoice/:id', invoiceController.updateInvoice);

// // Delete an invoice
// router.delete('/invoice/:id', invoiceController.deleteInvoice);



router.post('/:poId/grn/:grnId/stock', StockStorageController.updateStockStorage);

// New route for StockStorage by itemId
router.get('/stock/item/:itemId', StockStorageController.getStockStorageByItemId);
router.get('/stock/item', StockStorageController.getAllStockStorage); // New route


// router.post('/distribution', DistributionController.createDistribution); // New endpoint
// router.get('/distribution/:id', DistributionController.getDistributionById); // New endpoint
// router.delete('/distribution/:id', DistributionController.deleteDistribution); // New endpoint
// router.get('/distributions', DistributionController.getAllDistributions); // New endpoint

module.exports = router;