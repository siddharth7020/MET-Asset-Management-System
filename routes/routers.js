const express = require('express');
const router = express.Router();

const financialYearController = require('../controller/master/financialYearController');
const vendorController = require('../controller/master/vendor');
const instituteController = require('../controller/master/instituteController');
const unitController = require('../controller/master/unitController');
const categoryController = require('../controller/master/categoryController');
const itemController = require('../controller/master/itemController');
const locationController = require('../controller/purchase/locationController');

//financial year
router.post('/createFinancialYear', financialYearController.createFinancialYear);
router.get('/financialYears', financialYearController.getFinancialYears);
router.put('/updateFinancialYear/:id', financialYearController.updateFinancialYear);
router.delete('/deleteFinancialYear/:id', financialYearController.deleteFinancialYear);

//vendor
router.post('/createVendor', vendorController.createVendor);
router.get('/vendors', vendorController.getVendors);
router.put('/updateVendor/:id', vendorController.updateVendor);
router.delete('/deleteVendor/:id', vendorController.deleteVendor);

//institute
router.post('/createInstitute', instituteController.createInstitute);
router.get('/institutes', instituteController.getInstitutes);
router.put('/updateInstitute/:id', instituteController.updateInstitute);
router.delete('/deleteInstitute/:id', instituteController.deleteInstitute);

router.post('/createLocation', locationController.createLocation);
router.get('/locations', locationController.getAllLocations);
router.get('/location/:id', locationController.getLocationById);
router.put('/updateLocation/:id', locationController.updateLocation);
router.delete('/deleteLocation/:id', locationController.deleteLocation);

//unit
router.post('/createUnit', unitController.createUnit);
router.get('/units', unitController.getUnits);
router.put('/updateUnit/:id', unitController.updateUnit);
router.delete('/deleteUnit/:id', unitController.deleteUnit);

//category
router.post('/createCategory', categoryController.createCategory);
router.get('/categories', categoryController.getCategory);
router.put('/updateCategory/:id', categoryController.updateCategory);
router.delete('/deleteCategory/:id', categoryController.deleteCategory);

//item
router.post('/createItem', itemController.createItems);
router.get('/items', itemController.getItem);
router.put('/updateItem/:id', itemController.updateItem);
router.delete('/deleteItem/:id', itemController.deleteItem);

module.exports = router;