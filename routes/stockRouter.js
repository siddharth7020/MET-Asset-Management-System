const express = require('express');
const router = express.Router();

const StockStorageController = require('../controller/distribution/StockStograge');

// GET all stock storage
router.get('/allstock', StockStorageController.getAllStockStorage);
// GET stock storage by itemId
router.get('/stock/:itemId', StockStorageController.getStockStorageByItemId);