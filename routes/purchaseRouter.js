// routes/purchaseOrderRoutes.js
const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controller/purchase/poController');

router.post('/', purchaseOrderController.createPurchaseOrder);
router.get('/', purchaseOrderController.getAllPurchaseOrders);
router.get('/:poId', purchaseOrderController.getPurchaseOrderById);
router.put('/:poId', purchaseOrderController.updatePurchaseOrder);
router.delete('/:poId', purchaseOrderController.deletePurchaseOrder);

router.post('/:poId/grn', purchaseOrderController.createGRN);
router.put('/:poId/grn/:grnId', purchaseOrderController.updateGRN); // New route
router.delete('/:poId/grn/:grnId', purchaseOrderController.deleteGRN); // New
router.get('/:poId/grn/:grnId', purchaseOrderController.getGRNById);   // New
router.get('/:poId/grn', purchaseOrderController.getAllGRNs);

router.post('/:poId/grn/:grnId/stock', purchaseOrderController.updateStockStorage);

// New route for StockStorage by itemId
router.get('/stock/item/:itemId', purchaseOrderController.getStockStorageByItemId);

module.exports = router;