const Distribution = require('../../models/distribution/Distribution');
const DistributionItem = require('../../models/distribution/DistributionItem');
const Item = require('../../models/master/item');
const StockStorage = require('../../models/distribution/stockStorage');
const FinancialYear = require('../../models/master/financialYear');
const Institute = require('../../models/master/institute');
const sequelize = require('../../config/database');



// CREATE a Stock Distribution
const createDistribution = async (req, res) => {
    try {
        const { financialYearId, instituteId, employeeName, location, documents, remark, items } = req.body;

        // Validate required fields
        if (!financialYearId || !instituteId || !employeeName || !location || !items || items.length === 0) {
            return res.status(400).json({ message: 'financialYearId, instituteId, employeeName, location, and items are required' });
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

        // Validate items and stock availability
        const itemIds = items.map(item => item.itemId);
        const stockEntries = await StockStorage.findAll({
            where: { itemId: itemIds },
            attributes: ['itemId', [sequelize.fn('SUM', sequelize.col('quantity')), 'totalStock']],
            group: ['itemId']
        });

        for (const item of items) {
            const stock = stockEntries.find(se => se.itemId === item.itemId);
            const totalStock = stock ? parseInt(stock.getDataValue('totalStock')) : 0;
            if (!stock || item.issueQuantity > totalStock) {
                const itemName = (await Item.findByPk(item.itemId))?.itemName || 'Unknown';
                return res.status(400).json({
                    message: `Insufficient stock for item ${itemName} (ID: ${item.itemId}). Requested: ${item.issueQuantity}, Available: ${totalStock}`
                });
            }
        }

        let distribution;
        const transaction = await sequelize.transaction();
        try {
            // Create Distribution
            distribution = await Distribution.create({
                financialYearId,
                instituteId,
                employeeName,
                location,
                documents,
                remark
            }, { transaction });

            // Create Distribution Items
            const distributionItems = items.map(item => ({
                distributionId: distribution.id,
                itemId: item.itemId,
                itemName: item.itemName,
                issueQuantity: item.issueQuantity
            }));
            await DistributionItem.bulkCreate(distributionItems, { transaction });

            // Deduct stock from StockStorage
            for (const item of items) {
                let remainingQuantity = item.issueQuantity;
                const stockRecords = await StockStorage.findAll({
                    where: { itemId: item.itemId },
                    order: [['createdAt', 'ASC']] // Oldest first
                });

                const availableStock = stockRecords.filter(stock => stock.quantity > 0);
                if (availableStock.length === 0) {
                    throw new Error(`No available stock for itemId ${item.itemId}`);
                }

                for (const stock of availableStock) {
                    if (remainingQuantity <= 0) break;
                    const deduct = Math.min(remainingQuantity, stock.quantity);
                    await stock.update({ quantity: stock.quantity - deduct }, { transaction });
                    remainingQuantity -= deduct;
                }

                if (remainingQuantity > 0) {
                    throw new Error(`Could not deduct full quantity for itemId ${item.itemId}`);
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error; // Re-throw to outer catch
        }

        // Fetch created distribution after commit (outside transaction)
        try {
            const createdDistribution = await Distribution.findByPk(distribution.id, {
                include: [{ model: DistributionItem, as: 'item', include: [{ model: Item, as: 'item', attributes: ['itemName'] }] }]
            });

            if (!createdDistribution) {
                return res.status(500).json({ message: 'Distribution created but could not be retrieved' });
            }

            res.status(201).json({
                message: 'Distribution created successfully',
                data: createdDistribution
            });
        } catch (fetchError) {
            console.error('Error fetching created Distribution:', fetchError);
            // Transaction is already committed, so no rollback; just return success with a note
            return res.status(201).json({
                message: 'Distribution created successfully, but retrieval failed',
                data: { id: distribution.id },
                error: fetchError.message
            });
        }
    } catch (error) {
        console.error('Error creating Distribution:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// get a Distribution by ID
const getDistributionById = async (req, res) => {
    try {
        const { id } = req.params;
        const distribution = await Distribution.findByPk(id, {
            include: [{ model: DistributionItem, as: 'item', include: [{ model: Item, as: 'item', attributes: ['itemName'] }] }] // Include Item details
        });

        if (!distribution) {
            return res.status(404).json({ message: 'Distribution not found' });
        }

        res.json(distribution);
    } catch (error) {
        console.error('Error fetching Distribution:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// if i delete a distribution, the stock should be added back to the stock storage
const deleteDistribution = async (req, res) => {
    try {
        const { id } = req.params;
        const distribution = await Distribution.findByPk(id, { include: [{ model: DistributionItem, as: 'item' }] });

        if (!distribution) {
            return res.status(404).json({ message: 'Distribution not found' });
        }

        // Start a transaction
        const transaction = await sequelize.transaction();
        try {
            // Add stock back to StockStorage
            for (const item of distribution.item) {
                const stockRecord = await StockStorage.findOne({
                    where: { itemId: item.itemId },
                    order: [['createdAt', 'DESC']] // Newest first
                });

                if (stockRecord) {
                    await stockRecord.update({ quantity: stockRecord.quantity + item.issueQuantity }, { transaction });
                } else {
                    await StockStorage.create({
                        itemId: item.itemId,
                        quantity: item.issueQuantity
                    }, { transaction });
                }
            }

            // Delete the distribution and its items
            await DistributionItem.destroy({ where: { distributionId: id }, transaction });
            await Distribution.destroy({ where: { id }, transaction });

            // Commit the transaction
            await transaction.commit();

            res.status(200).json({ message: 'Distribution deleted successfully' });
        } catch (error) {
            await transaction.rollback();
            console.error('Error deleting Distribution:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    } catch (error) {
        console.error('Error fetching Distribution for deletion:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
// Update a Distribution


// Export the functions
module.exports = {
    createDistribution,
    getDistributionById,
    deleteDistribution
};