const PurchaseOrder = require('../../model/purchase/purchaseOrder');
const OrderItem = require('../../model/purchase/orderItem');
const Item = require('../../model/master/item');
const FinancialYear = require('../../model/master/financialYear');
const Vendor = require('../../model/master/vendor');
const Institute = require('../../model/master/institute');


exports.createPo = async (req, res) => {
    try {
        const { poDate, poNo, instituteId, financialYearId, vendorId, document, requestedBy, remark, assetQuantity, assetData } = req.body;

        // Check if the financial year exists
        const financialYear = await FinancialYear.findByPk(financialYearId);
        if (!financialYear) {    
            return res.status(404).json({
                success: false,
                message: 'Financial Year not found'
            });
        }

        // Check if the vendor exists
        const vendor = await Vendor.findByPk(vendorId);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Check if the institute exists
        const institute = await Institute.findByPk(instituteId);
        if (!institute) {
            return res.status(404).json({
                success: false,
                message: 'Institute not found'
            });
        }

        // Check if the items exist
        const items = await Item.findAll({
            where: {
                itemId: assetData.map(item => item.itemId)
            }
        });
        if (items.length !== assetData.length) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        // Create a new Purchase Order
        const newPo = await PurchaseOrder.create({
            poDate,
            poNo,
            instituteId,
            financialYearId,
            vendorId,
            document,
            requestedBy,
            remark,
            assetQuantity,
            assetData
        });

        // when creating a new Purchase Order, create Order Items
        for (let i = 0; i < assetData.length; i++) {
            await OrderItem.create({
                poId: newPo.poId,
                itemId: assetData[i].itemId,
                quantity: assetData[i].quantity,
                rate: assetData[i].rate,
                amount: assetData[i].amount,
                discount: assetData[i].discount,
                tax1: assetData[i].tax1,
                tax2: assetData[i].tax2,
                totalTax: assetData[i].totalTax,
                totalAmount: assetData[i].totalAmount,
                acceptedQuantity: assetData[i].acceptedQuantity,
                rejectedQuantity: assetData[i].rejectedQuantity
            });
        }

        // Return success response
        return res.status(201).json({
            success: true,
            data: newPo,
            message: 'Purchase Order created successfully'
        });



    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error creating Purchase Order'
        });
    }
};

exports.getAllPo = async (req, res) => {
    try {
        const po = await PurchaseOrder.findAll();
        return res.status(200).json({
            success: true,
            data: po
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error fetching Purchase Orders'
        });
    }
};

exports.updatePo = async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Purchase Order ID not provided'
            });
        }

        const po = await PurchaseOrder.findByPk(id);
        if (!po) {
            return res.status(404).json({
                success: false,
                message: 'Purchase Order not found'
            });
        }

        const updateData = req.body;

        // Update the PO
        await po.update(updateData);

        // Update the asset data if provided
        if (updateData.assetData) {
            await Promise.all(updateData.assetData.map(async (item) => {
                const orderItem = await OrderItem.findOne({
                    where: {
                        poId: id,
                        itemId: item.itemId
                    }
                });

                if (orderItem) {
                    await orderItem.update(item);
                }
            }));
        }

        return res.status(200).json({
            success: true,
            message: 'Purchase Order updated successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error updating Purchase Order'
        });
    }
};

exports.deletePo = async (req, res) => {
    try {
        const { id } = req.params;
        const po = await PurchaseOrder.findByPk(id);
        if (!po) {
            return res.status(404).json({
                success: false,
                message: 'Purchase Order not found'
            });
        }

        // Delete associated Order Items
        await OrderItem.destroy({
            where: { poId: id }
        });

        await po.destroy();
        return res.status(200).json({
            success: true,
            message: 'Purchase Order deleted successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error deleting Purchase Order'
        });
    }
};