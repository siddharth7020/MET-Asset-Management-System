const Return = require('../../models/distribution/Return');
const ReturnItem = require('../../models/distribution/ReturnItem');
const Distribution = require('../../models/distribution/Distribution');
const DistributionItem = require('../../models/distribution/DistributionItem');
const Item = require('../../models/master/item');
const StockStorage = require('../../models/distribution/stockStorage');
const FinancialYear = require('../../models/master/financialYear');
const Institute = require('../../models/master/institute');
const sequelize = require('../../config/database');

// CREATE a Return
const createReturn = async (req, res) => {
    try {
        const { distributionId, financialYearId, instituteId, employeeName, location, documents, remark, items } = req.body;

        // Validate required fields
        if (!distributionId || !financialYearId || !instituteId || !employeeName || !location || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'distributionId, financialYearId, instituteId, employeeName, location, and items are required' });
        }

        // Validate distributionId
        const distribution = await Distribution.findByPk(distributionId, {
            include: [{ model: DistributionItem, as: 'items' }]
        });
        if (!distribution) {
            return res.status(404).json({ message: `Distribution with ID ${distributionId} not found` });
        }

        // Validate financialYearId and instituteId
        const financialYear = await FinancialYear.findByPk(financialYearId);
        if (!financialYear) {
            return res.status(404).json({ message: `Financial Year with ID ${financialYearId} not found` });
        }
        const institute = await Institute.findByPk(instituteId);
        if (!institute) {
            return res.status(404).json({ message: `Institute with ID ${instituteId} not found` });
        }

        // Validate items and return quantities
        const itemIds = items.map(item => item.itemId);
        for (const item of items) {
            if (!item.itemId || !item.returnQuantity || item.returnQuantity <= 0) {
                return res.status(400).json({ message: `Invalid item data for itemId ${item.itemId}` });
            }

            const dbItem = await Item.findByPk(item.itemId);
            if (!dbItem) {
                return res.status(404).json({ message: `Item with ID ${item.itemId} not found` });
            }

            const distributionItem = distribution.items.find(di => di.itemId === item.itemId);
            if (!distributionItem) {
                return res.status(400).json({ message: `Item with ID ${item.itemId} not found in Distribution ${distributionId}` });
            }

            if (item.returnQuantity > distributionItem.issueQuantity) {
                return res.status(400).json({
                    message: `Return quantity for item ${dbItem.itemName} (ID: ${item.itemId}) exceeds issued quantity. Requested: ${item.returnQuantity}, Issued: ${distributionItem.issueQuantity}`
                });
            }
        }

        let returnRecord;
        const transaction = await sequelize.transaction();
        try {
            // Create Return
            returnRecord = await Return.create({
                distributionId,
                financialYearId,
                instituteId,
                employeeName,
                location,
                documents,
                remark
            }, { transaction });

            // Create Return Items
            const returnItems = items.map(item => ({
                returnId: returnRecord.id,
                itemId: item.itemId,
                returnQuantity: item.returnQuantity
            }));
            await ReturnItem.bulkCreate(returnItems, { transaction });

            // Restore stock to StockStorage
            for (const item of items) {
                const stockRecords = await StockStorage.findAll({
                    where: { itemId: item.itemId },
                    order: [['createdAt', 'DESC']],
                    transaction
                });

                if (stockRecords.length > 0) {
                    // Update the most recent stock record
                    const latestStock = stockRecords[0];
                    await latestStock.update(
                        { quantity: latestStock.quantity + item.returnQuantity },
                        { transaction }
                    );
                } else {
                    // Create a new stock record if none exists
                    await StockStorage.create(
                        {
                            itemId: item.itemId,
                            quantity: item.returnQuantity
                        },
                        { transaction }
                    );
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        // Fetch created return after commit
        try {
            const createdReturn = await Return.findByPk(returnRecord.id, {
                include: [{ model: ReturnItem, as: 'items', include: [{ model: Item, as: 'item', attributes: ['itemName'] }] }]
            });

            if (!createdReturn) {
                return res.status(500).json({ message: 'Return created but could not be retrieved' });
            }

            res.status(201).json({
                message: 'Return created successfully',
                data: createdReturn
            });
        } catch (fetchError) {
            console.error('Error fetching created Return:', fetchError);
            return res.status(201).json({
                message: 'Return created successfully, but retrieval failed',
                data: { id: returnRecord.id },
                error: fetchError.message
            });
        }
    } catch (error) {
        console.error('Error creating Return:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Export the function
module.exports = {
    createReturn
};