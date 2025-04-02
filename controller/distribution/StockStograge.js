const GRN = require('../../models/purchase/GRN');
const GRNItem = require('../../models/purchase/GRNItem');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const Item = require('../../models/master/item');
const StockStorage = require('../../models/distribution/stockStorage');
const sequelize = require('../../config/database');



// CREATE or UPDATE StockStorage when GRN is processed
const updateStockStorage = async (req, res) => {
    try {
        const { poId, grnId } = req.params;
        const { grnItems } = req.body;

        // Validate PurchaseOrder and GRN
        const purchaseOrder = await PurchaseOrder.findByPk(poId);
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }
        const grn = await GRN.findOne({ where: { id: grnId, poId } });
        if (!grn) {
            return res.status(404).json({ message: 'GRN not found' });
        }

        // Process each GRNItem
        if (grnItems && grnItems.length > 0) {
            for (const item of grnItems) {
                const grnItem = await GRNItem.findByPk(item.orderItemId);
                if (!grnItem) {
                    return res.status(400).json({ message: `GRNItem with orderItemId ${item.orderItemId} not found` });
                }

                // Check if StockStorage entry exists
                const stockEntry = await StockStorage.findOne({
                    where: { poId, grnId, itemId: grnItem.orderItemId }
                });

                if (stockEntry) {
                    // Update existing entry
                    await stockEntry.update({
                        quantity: item.receivedQuantity,
                        remark: item.remark || stockEntry.remark
                    });
                } else {
                    // Create new entry
                    await StockStorage.create({
                        poId,
                        grnId,
                        itemId: grnItem.orderItemId,
                        quantity: item.receivedQuantity,
                        remark: item.remark
                    });
                }
            }
        }

        // Fetch updated stock for this GRN
        const stock = await StockStorage.findAll({ where: { grnId } });
        res.status(200).json(stock);
    } catch (error) {
        console.error('Error updating StockStorage:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// GET StockStorage details for a specific itemId (how many GRNs it appears in)
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
                'grn.id', // Include grn.id
                'purchaseOrder.poId', // Include purchaseOrder.poId
                [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity'], // Sum quantities per grnId
            ],
            group: ['grnId', 'grn.id', 'purchaseOrder.poId'], // Group by grnId, grn.id, and purchaseOrder.poId
            include: [
                { model: GRN, as: 'grn', attributes: ['grnNo', 'grnDate'] },
                { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['poId', 'poNo'] }
            ],
            order: [['grnId', 'ASC']] // Optional: sort by grnId
        });

        if (stockEntries.length === 0) {
            return res.status(404).json({ message: `No stock entries found for itemId ${itemId}` });
        }

        // Calculate totalItemCount (sum of totalQuantity across all GRNs)
        const totalItemCount = stockEntries.reduce((sum, entry) => {
            return sum + parseInt(entry.getDataValue('totalQuantity'));
        }, 0);

        // Format response
        const response = {
            itemId,
            itemName: item.itemName, // Changed from item.itemName to item.name (assuming standard naming)
            grnCount: stockEntries.length, // Number of unique GRNs
            totalItemCount, // Total quantity across all GRNs
            grnDetails: stockEntries.map(entry => ({
                grnId: entry.grnId,
                grnNo: entry.grn?.grnNo,
                grnDate: entry.grn?.grnDate,
                poId: entry.purchaseOrder?.poId,
                poNo: entry.purchaseOrder?.poNo,
                totalQuantity: parseInt(entry.getDataValue('totalQuantity')) // Quantity per GRN
            }))
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching StockStorage by itemId:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// get all stock storage
const getAllStockStorage = async (req, res) => {
    try {
        const stock = await StockStorage.findAll();
        res.status(200).json(stock);
    } catch (error) {
        console.error('Error fetching StockStorage:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = {
    updateStockStorage,
    getStockStorageByItemId,
    getAllStockStorage
};