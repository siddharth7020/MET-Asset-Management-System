const PurchaseOrder = require('../../model/purchase/purchaseOrder');

//get the all purchase order
exports.getAllPurchaseOrders = (req, res, next) => {
    PurchaseOrder.findAll()
        .then(purchaseOrders => {
            res.status(200).json(purchaseOrders);
        })
        .catch(err => {
            res.status(500).json({
                message: 'Error',
                error: err
            });
        });
};

//create the purchase order
exports.createPurchaseOrder = (req, res, next) => {
    PurchaseOrder.create({
        poDate: req.body.poDate,
        poNo: req.body.poNo,
        instituteId: req.body.instituteId,
        financialYearId: req.body.financialYearId,
        vendorId: req.body.vendorId,
        document: req.body.document,
        requestedBy: req.body.requestedBy,
        remark: req.body.remark,
        assetQuantity: req.body.assetQuantity,
        assetData: req.body.assetData
    })
        .then(purchaseOrder => {
            res.status(201).json(purchaseOrder);
        })
        .catch(err => {
            res.status(500).json({
                message: 'Error',
                error: err
            });
        });
};

//update the purchase order
exports.updatePurchaseOrder = async (req, res, next) => {
    try {
        // Find the existing purchase order by poId
        const purchaseOrder = await PurchaseOrder.findOne({
            where: { poId: req.params.id }
        });

        if (!purchaseOrder) {
            return res.status(404).json({
                message: 'Purchase order not found'
            });
        }

        // Get the existing assetData (JSON object)
        const existingAssetData = purchaseOrder.assetData || {};

        // Prepare the updated data
        const updatedData = {
            poDate: req.body.poDate || purchaseOrder.poDate, // Keep existing value if not provided
            poNo: req.body.poNo || purchaseOrder.poNo,
            instituteId: req.body.instituteId || purchaseOrder.instituteId,
            financialYearId: req.body.financialYearId || purchaseOrder.financialYearId,
            vendorId: req.body.vendorId || purchaseOrder.vendorId,
            document: req.body.document || purchaseOrder.document,
            requestedBy: req.body.requestedBy || purchaseOrder.requestedBy,
            remark: req.body.remark || purchaseOrder.remark,
            assetQuantity: req.body.assetQuantity || purchaseOrder.assetQuantity,
            // Merge existing assetData with only the provided fields from req.body.assetData
            assetData: {
                ...existingAssetData,
                ...(req.body.assetData || {}) // Only update fields provided in the request
            }
        };

        // Perform the update
        await PurchaseOrder.update(updatedData, {
            where: { poId: req.params.id }
        });

        // Fetch the updated record to return it
        const updatedPurchaseOrder = await PurchaseOrder.findOne({
            where: { poId: req.params.id }
        });

        res.status(200).json(updatedPurchaseOrder);
    } catch (err) {
        res.status(500).json({
            message: 'Error',
            error: err
        });
    }
};
//delete the purchase order
exports.deletePurchaseOrder = (req, res, next) => {
    PurchaseOrder.destroy({
        where: {
            poId: req.params.id
        }
    })
        .then(purchaseOrder => {
            res.status(200).json(purchaseOrder);
        })
        .catch(err => {
            res.status(500).json({
                message: 'Error',
                error: err
            });
        });
};