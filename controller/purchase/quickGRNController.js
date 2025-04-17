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

const getAllQuickGRNs = async (req, res) => {
    try {
        const quickGRNs = await QuickGRN.findAll();

        res.status(200).json(quickGRNs);
    } catch (error) {
        console.error('Error fetching Quick GRNs:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};


// Fetch QuickGRN by ID with associated items
const getQuickGRNById = async (req, res) => {
    try {
        const { id } = req.params;
        const quickGRN = await QuickGRN.findByPk(id, {
            include: [{ model: QuickGRNItem, as: 'items' }]
        });

        if (!quickGRN) {
            return res.status(404).json({ message: 'Quick GRN not found' });
        }

        res.status(200).json(quickGRN);
    } catch (error) {
        console.error('Error fetching Quick GRN:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Update QuickGRN with Items and Stock Storage
const updateQuickGRN = async (req, res) => {
    try {
        const { id } = req.params;
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
            quickGRNItems // Array of { qGRNItemid, itemId, quantity, rate, discount, receivedQuantity, rejectedQuantity }
        } = req.body;

        const transaction = await sequelize.transaction();
        try {
            // Find QuickGRN
            const quickGRN = await QuickGRN.findByPk(id, { transaction });
            if (!quickGRN) {
                await transaction.rollback();
                return res.status(404).json({ message: 'QuickGRN not found' });
            }

            // Update QuickGRN fields
            await quickGRN.update({
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

            // Get existing QuickGRNItems
            const existingItems = await QuickGRNItem.findAll({
                where: { qGRNId: id },
                transaction
            });

            // Prepare new QuickGRNItems data
            const newItemIds = quickGRNItems.map(item => item.qGRNItemid).filter(id => id);
            const itemsToDelete = existingItems.filter(item => !newItemIds.includes(item.qGRNItemid));

            // Delete items that are no longer in the input
            if (itemsToDelete.length > 0) {
                const deleteItemIds = itemsToDelete.map(item => item.qGRNItemid);
                await QuickGRNItem.destroy({
                    where: { qGRNItemid: deleteItemIds },
                    transaction
                });

                // Delete corresponding StockStorage records for removed items
                await StockStorage.destroy({
                    where: { qGRNId: id, itemId: itemsToDelete.map(item => item.itemId) },
                    transaction
                });
            }

            // Update or create QuickGRNItems
            for (const item of quickGRNItems) {
                const {
                    qGRNItemid,
                    itemId,
                    quantity,
                    rate,
                    discount = 0,
                    receivedQuantity,
                    rejectedQuantity = 0
                } = item;

                const amount = quantity * rate;
                const totalAmount = amount - discount;

                let existingItem = qGRNItemid ? await QuickGRNItem.findByPk(qGRNItemid, { transaction }) : null;

                if (existingItem) {
                    // Update existing item
                    await existingItem.update({
                        itemId,
                        quantity,
                        rate,
                        amount,
                        discount,
                        totalAmount,
                        receivedQuantity,
                        rejectedQuantity
                    }, { transaction });
                } else {
                    // Create new item
                    existingItem = await QuickGRNItem.create({
                        qGRNId: id,
                        itemId,
                        quantity,
                        rate,
                        amount,
                        discount,
                        totalAmount,
                        receivedQuantity,
                        rejectedQuantity
                    }, { transaction });
                }

                // Update or create StockStorage
                let stockRecord = await StockStorage.findOne({
                    where: { qGRNId: id, itemId },
                    transaction
                });

                if (stockRecord) {
                    // Update existing stock record
                    await stockRecord.update({
                        quantity: receivedQuantity,
                        remark: remark || stockRecord.remark
                    }, { transaction });
                } else {
                    // Create new stock record
                    await StockStorage.create({
                        poId: null,
                        grnId: null,
                        qGRNId: id,
                        itemId,
                        quantity: receivedQuantity,
                        remark
                    }, { transaction });
                }
            }

            await transaction.commit();

            // Fetch updated record
            const updatedQuickGRN = await QuickGRN.findByPk(id, {
                include: [{ model: QuickGRNItem, as: 'items' }]
            });

            res.status(200).json(updatedQuickGRN);
        } catch (error) {
            await transaction.rollback();
            console.error('Error updating QuickGRN:', error);
            res.status(500).json({ message: 'Error updating QuickGRN', error: error.message });
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Delete QuickGRN and associated items and stock records
const deleteQuickGRN = async (req, res) => {
    const { id } = req.params;

    const transaction = await sequelize.transaction();
    try {
        // Find the QuickGRN
        const quickGRN = await QuickGRN.findByPk(id, { transaction });

        if (!quickGRN) {
            await transaction.rollback();
            return res.status(404).json({ message: 'QuickGRN not found' });
        }

        // Delete associated QuickGRNItems
        await QuickGRNItem.destroy({
            where: { qGRNId: id },
            transaction
        });

        // Delete related stock storage records
        await StockStorage.destroy({
            where: { qGRNId: id },
            transaction
        });

        // Delete the QuickGRN
        await quickGRN.destroy({ transaction });

        await transaction.commit();
        res.status(200).json({ message: 'QuickGRN and related records deleted successfully' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error deleting QuickGRN:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = {
    createQuickGRN,
    getQuickGRNById,
    getAllQuickGRNs,
    updateQuickGRN,
    deleteQuickGRN
};