const StockStorage = require('../../models/distribution/stockStorage');
const Item = require('../../models/master/item');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');

// GET all StockStorage entries
const getAllStockStorage = async (req, res) => {
    try {
        const stock = await StockStorage.findAll();

        // Format response to include only model fields
        const formattedStock = stock.map(entry => ({
            id: entry.id,
            poId: entry.poId,
            grnId: entry.grnId,
            qGRNId: entry.qGRNId,
            itemId: entry.itemId,
            storeCode: entry.storeCode,
            unitId: entry.unitId,
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
                'id',
                'poId',
                'grnId',
                'qGRNId',
                'itemId',
                'storeCode',
                'unitId',
                'quantity',
                'remark',
                'createdAt',
                'updatedAt',
                [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity']
            ],
            group: ['grnId', 'storeCode', 'unitId', 'id', 'poId', 'qGRNId', 'itemId', 'quantity', 'remark', 'createdAt', 'updatedAt'],
            order: [['grnId', 'ASC']]
        });

        if (stockEntries.length === 0) {
            return res.status(404).json({ message: `No stock entries found for itemId ${itemId}` });
        }

        // Calculate totalItemCount
        const totalItemCount = stockEntries.reduce((sum, entry) => {
            return sum + parseInt(entry.getDataValue('totalQuantity'));
        }, 0);

        // Format response to include only model fields
        const response = {
            itemId,
            grnCount: stockEntries.length,
            totalItemCount,
            grnDetails: stockEntries.map(entry => ({
                id: entry.id,
                poId: entry.poId,
                grnId: entry.grnId,
                qGRNId: entry.qGRNId,
                itemId: entry.itemId,
                storeCode: entry.storeCode,
                unitId: entry.unitId,
                quantity: entry.quantity,
                remark: entry.remark,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt,
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