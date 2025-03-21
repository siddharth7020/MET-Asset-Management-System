const express = require('express');
const router = express.Router();

const PurchaseOrderController = require('../controller/purchase/poController');
const GRNController = require('../controller/purchase/grnController');
const InvoiceController = require('../controller/purchase/invoiceController');


router.post('/createPo', PurchaseOrderController.createPo);

router.post('/createGrn', GRNController.createGrn);
router.get('/allGrns', GRNController.getAllGrns);
router.put('/updateGrn/:id', GRNController.updateGrn);
router.delete('/deleteGrn/:id', GRNController.deleteGrn);

router.post('/createInvoice', InvoiceController.createInvoice);
router.get('/allInvoices', InvoiceController.getAllInvoices);
router.put('/updateInvoice/:id', InvoiceController.updateInvoice);
router.delete('/deleteInvoice/:id', InvoiceController.deleteInvoice);

module.exports = router;