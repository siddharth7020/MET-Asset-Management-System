const QuickGRN = require('../../models/purchase/quickGRN');
const QuickGRNItem = require('../../models/purchase/quickGRNItem');
const StockStorage = require('../../models/distribution/stockStorage'); // Import StockStorage model
const sequelize = require('../../config/database'); // Import sequelize for transactions

// Create QuickGRN with Items and Stock Storage
const createQuickGRN = async (req, res) => {
    try {
        const {
            qGRNDate,
            qGRNNo,
            instituteId,
            financialYearId,
            vendorId,
            challanNo,
            challanDate,
            document,
            requestedBy,
            remark,
            quickGRNItems // Array of { itemId, quantity, rate, discount, receivedQuantity, rejectedQuantity }
        } = req.body;

        // Validate required fields
        if (!qGRNDate || !qGRNNo || !instituteId || !financialYearId || !vendorId) {
            return res.status(400).json({ message: 'qGRNDate, qGRNNo, instituteId, financialYearId, and vendorId are required' });
        }

        const transaction = await sequelize.transaction();
        try {
            // Create QuickGRN
            const quickGRN = await QuickGRN.create({
                qGRNDate,
                qGRNNo,
                instituteId,
                financialYearId,
                vendorId,
                challanNo,
                challanDate,
                document,
                requestedBy,
                remark
            }, { transaction });

            // Create associated QuickGRN Items
            let quickGRNItemData = [];
            if (quickGRNItems && quickGRNItems.length > 0) {
                quickGRNItemData = quickGRNItems.map(item => ({
                    qGRNId: quickGRN.qGRNId,
                    itemId: item.itemId,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.quantity * item.rate,
                    discount: item.discount || 0,
                    totalAmount: (item.quantity * item.rate) - (item.discount || 0),
                    receivedQuantity: item.receivedQuantity || 0,
                    rejectedQuantity: item.rejectedQuantity || 0
                }));
                await QuickGRNItem.bulkCreate(quickGRNItemData, { transaction });
            }

            // Stock Update in StockStorage
            for (const item of quickGRNItemData) {
                const stockRecord = await StockStorage.findOne({
                    where: { qGRNId: quickGRN.qGRNId, itemId: item.itemId },
                    transaction
                });

                if (stockRecord) {
                    // Update existing stock record
                    await stockRecord.update({
                        quantity: stockRecord.quantity + item.receivedQuantity,
                        remark: remark || stockRecord.remark
                    }, { transaction });
                } else {
                    // Create new stock record
                    await StockStorage.create({
                        poId: null, // Set to null or a relevant poId if applicable
                        grnId: null, // Set to null since this is QuickGRN
                        qGRNId: quickGRN.qGRNId,
                        itemId: item.itemId,
                        quantity: item.receivedQuantity,
                        remark: remark || null
                    }, { transaction });
                }
            }

            await transaction.commit();

            // Fetch the created QuickGRN with its items
            const createdQuickGRN = await QuickGRN.findByPk(quickGRN.qGRNId, {
                include: [{ model: QuickGRNItem, as: 'items' }]
            });

            res.status(201).json(createdQuickGRN);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error creating QuickGRN:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = {
    createQuickGRN
};