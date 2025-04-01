// routes/purchaseOrderRoutes.js
const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controller/purchase/poController');
const GRNController = require('../controller/purchase/grnController');
const DistributionController = require('../controller/distribution/DistributionController');
const StockStorageController = require('../controller/distribution/StockStograge');


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

router.post('/:poId/grn/:grnId/stock', StockStorageController.updateStockStorage);

// New route for StockStorage by itemId
router.get('/stock/item/:itemId', StockStorageController.getStockStorageByItemId);


router.post('/distribution', DistributionController.createDistribution); // New endpoint
router.get('/distribution/:id', DistributionController.getDistributionById); // New endpoint

module.exports = router;