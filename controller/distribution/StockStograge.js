const GRN = require('../../models/purchase/GRN');
const GRNItem = require('../../models/purchase/GRNItem');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const Item = require('../../models/master/item');
const Unit = require('../../models/master/unit');
const StockStorage = require('../../models/distribution/stockStorage');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');

// GET all StockStorage entries
const getAllStockStorage = async (req, res) => {
    try {
        const stock = await StockStorage.findAll();

        // Format response to include all relevant fields
        const formattedStock = stock.map(entry => ({
            id: entry.id,
            poId: entry.poId,
            poNo: entry.grn?.purchaseOrder?.poNo || null,
            grnId: entry.grnId,
            grnNo: entry.grn?.grnNo || null,
            grnDate: entry.grn?.grnDate || null,
            qGRNId: entry.qGRNId,
            itemId: entry.itemId,
            itemName: entry.item?.itemName || null,
            storeCode: entry.storeCode,
            unitId: entry.unitId,
            unitName: entry.unit?.name || null,
            quantity: entry.quantity,
            remark: entry.remark,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        }));

        res.status(200).json(formattedStock);
    } catch (error) {
        console.error('Error fetching StockStorage:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// GET StockStorage details for a specific itemId
const getStockStorageByItemId = async (req, res) => {
    try {
        const { itemId } = req.params;

        // Validate itemId
        const item = await Item.findByPk(itemId);
        if (!item) {
            return res.status(404).json({ message: `Item with ID ${itemId} not found` });
        }

        // Fetch StockStorage entries for this itemId, grouped by grnId
        const stockEntries = await StockStorage.findAll({
            where: { itemId },
            attributes: [
                'grnId',
                'storeCode',
                'unitId',
                [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity'],
            ],
            group: ['grnId', 'storeCode', 'unitId', 'grn.id', 'purchaseOrder.poId', 'unit.id'],
            include: [
                { 
                    model: GRN, 
                    as: 'grn', 
                    attributes: ['id', 'grnNo', 'grnDate'],
                    include: [{ model: PurchaseOrder, as: 'purchaseOrder', attributes: ['poId', 'poNo'] }]
                },
                { model: Unit, as: 'unit', attributes: ['id', 'name'] }
            ],
            order: [['grnId', 'ASC']]
        });

        if (stockEntries.length === 0) {
            return res.status(404).json({ message: `No stock entries found for itemId ${itemId}` });
        }

        // Calculate totalItemCount
        const totalItemCount = stockEntries.reduce((sum, entry) => {
            return sum + parseInt(entry.getDataValue('totalQuantity'));
        }, 0);

        // Format response
        const response = {
            itemId,
            itemName: item.itemName,
            grnCount: stockEntries.length,
            totalItemCount,
            grnDetails: stockEntries.map(entry => ({
                grnId: entry.grnId,
                grnNo: entry.grn?.grnNo || null,
                grnDate: entry.grn?.grnDate || null,
                poId: entry.grn?.purchaseOrder?.poId || null,
                poNo: entry.grn?.purchaseOrder?.poNo || null,
                storeCode: entry.storeCode,
                unitId: entry.unitId,
                unitName: entry.unit?.name || null,
                totalQuantity: parseInt(entry.getDataValue('totalQuantity'))
            }))
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching StockStorage by itemId:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = {
    getAllStockStorage,
    getStockStorageByItemId
};