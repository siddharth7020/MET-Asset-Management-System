const { Op } = require('sequelize');
const Distribution = require('../../models/distribution/Distribution');
const DistributionItem = require('../../models/distribution/DistributionItem');
const Item = require('../../models/master/item');
const StockStorage = require('../../models/distribution/stockStorage');
const FinancialYear = require('../../models/master/financialYear');
const Institute = require('../../models/master/institute');
const sequelize = require('../../config/database');

// GET all Distributions
const getAllDistributions = async (req, res) => {
    try {
        const distributions = await Distribution.findAll({
            include: [{ model: DistributionItem, as: 'items', include: [{ model: Item, as: 'item', attributes: ['itemName'] }] }]
        });
        res.json(distributions);
    } catch (error) {
        console.error('Error fetching Distributions:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// CREATE a Stock Distribution
const createDistribution = async (req, res) => {
    try {
        const {
            financialYearId,
            instituteId,
            employeeName,
            location,
            distributionDate = new Date(), // Default to current date if not provided
            documents,
            remark,
            items
        } = req.body;

        // Validate required fields
        if (!financialYearId || !instituteId || !employeeName || !location || !distributionDate || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'financialYearId, instituteId, employeeName, location, distributionDate, and items are required' });
        }

        // Validate distributionDate
        if (isNaN(Date.parse(distributionDate))) {
            return res.status(400).json({ message: 'Invalid distributionDate format' });
        }

        // Generate distributionNo in format DIS-DDMMYY-01
        const date = new Date(distributionDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = String(date.getFullYear()).slice(-2); // Last two digits of year
        const dateString = `${day}${month}${year}`; // Format: DDMMYY

        // Find the last distribution number for the same date to increment the sequence
        const lastDistribution = await Distribution.findOne({
            where: {
                distributionNo: {
                    [Op.like]: `DIS-${dateString}-%`
                }
            },
            order: [['distributionNo', 'DESC']]
        });

        // Extract the sequence number and increment it
        let sequence = 1;
        if (lastDistribution && lastDistribution.distributionNo) {
            const parts = lastDistribution.distributionNo.split('-');
            if (parts.length === 3 && !isNaN(parts[2])) {
                const lastSequence = parseInt(parts[2], 10);
                sequence = lastSequence + 1;
            } else {
                console.warn(`Invalid distributionNo format found: ${lastDistribution.distributionNo}. Starting sequence at 1.`);
            }
        }
        const distributionNo = `DIS-${dateString}-${String(sequence).padStart(2, '0')}`;

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
            if (!item.itemId || !item.issueQuantity || item.issueQuantity <= 0) {
                return res.status(400).json({ message: `Invalid item data for itemId ${item.itemId}` });
            }

            const dbItem = await Item.findByPk(item.itemId);
            if (!dbItem) {
                return res.status(404).json({ message: `Item with ID ${item.itemId} not found` });
            }

            const stock = stockEntries.find(se => se.itemId === item.itemId);
            const totalStock = stock ? parseInt(stock.getDataValue('totalStock')) : 0;
            if (!stock || item.issueQuantity > totalStock) {
                return res.status(400).json({
                    message: `Insufficient stock for item ${dbItem.itemName} (ID: ${item.itemId}). Requested: ${item.issueQuantity}, Available: ${totalStock}`
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
                distributionDate,
                distributionNo,
                documents,
                remark
            }, { transaction });

            // Create Distribution Items
            const distributionItems = items.map(item => ({
                distributionId: distribution.id,
                itemId: item.itemId,
                issueQuantity: item.issueQuantity
            }));
            await DistributionItem.bulkCreate(distributionItems, { transaction });

            // Deduct stock from StockStorage
            for (const item of items) {
                let remainingQuantity = item.issueQuantity;
                const stockRecords = await StockStorage.findAll({
                    where: { itemId: item.itemId, quantity: { [Op.gt]: 0 } },
                    order: [['createdAt', 'ASC']],
                    transaction
                });

                if (!stockRecords || stockRecords.length === 0) {
                    throw new Error(`No available stock for itemId ${item.itemId}`);
                }

                for (const stock of stockRecords) {
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
            throw error;
        }

        // Fetch created distribution after commit
        try {
            const createdDistribution = await Distribution.findByPk(distribution.id, {
                include: [{ model: DistributionItem, as: 'items', include: [{ model: Item, as: 'item', attributes: ['itemName'] }] }]
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

// UPDATE a Stock Distribution
const updateDistribution = async (req, res) => {
    try {
        const { id } = req.params;
        const { financialYearId, instituteId, employeeName, location, distributionDate, distributionNo, documents, remark, items } = req.body;

        // Check if distribution exists
        const distribution = await Distribution.findByPk(id, {
            include: [{ model: DistributionItem, as: 'items' }]
        });
        if (!distribution) {
            return res.status(404).json({ message: 'Distribution not found' });
        }

        // Validate financialYearId and instituteId if provided
        if (financialYearId) {
            const financialYear = await FinancialYear.findByPk(financialYearId);
            if (!financialYear) {
                return res.status(404).json({ message: `Financial Year with ID ${financialYearId} not found` });
            }
        }
        if (instituteId) {
            const institute = await Institute.findByPk(instituteId);
            if (!institute) {
                return res.status(404).json({ message: `Institute with ID ${instituteId} not found` });
            }
        }

        // Validate distributionDate if provided
        if (distributionDate && isNaN(Date.parse(distributionDate))) {
            return res.status(400).json({ message: 'Invalid distributionDate format' });
        }

        // Validate distributionNo uniqueness if provided
        if (distributionNo && distributionNo !== distribution.distributionNo) {
            const existingDistribution = await Distribution.findOne({ where: { distributionNo } });
            if (existingDistribution) {
                return res.status(400).json({ message: `Distribution number ${distributionNo} already exists` });
            }
        }

        // Validate items if provided
        let newItemIds = [];
        if (items && Array.isArray(items)) {
            if (items.length === 0) {
                return res.status(400).json({ message: 'Items array cannot be empty' });
            }
            newItemIds = items.map(item => item.itemId);
            for (const item of items) {
                if (!item.itemId || !item.issueQuantity || item.issueQuantity <= 0) {
                    return res.status(400).json({ message: `Invalid item data for itemId ${item.itemId}` });
                }
                const dbItem = await Item.findByPk(item.itemId);
                if (!dbItem) {
                    return res.status(404).json({ message: `Item with ID ${item.itemId} not found` });
                }
            }
        }

        const transaction = await sequelize.transaction();
        try {
            // Update Distribution fields (only if provided)
            await distribution.update({
                financialYearId: financialYearId || distribution.financialYearId,
                instituteId: instituteId || distribution.instituteId,
                employeeName: employeeName || distribution.employeeName,
                location: location || distribution.location,
                distributionDate: distributionDate || distribution.distributionDate,
                distributionNo: distributionNo || distribution.distributionNo,
                documents: documents !== undefined ? documents : distribution.documents,
                remark: remark !== undefined ? remark : distribution.remark
            }, { transaction });

            // Handle items update if provided
            if (items && Array.isArray(items)) {
                // Calculate stock adjustments
                const existingItems = distribution.items.reduce((acc, item) => {
                    acc[item.itemId] = item.issueQuantity;
                    return acc;
                }, {});
                const newItems = items.reduce((acc, item) => {
                    acc[item.itemId] = item.issueQuantity;
                    return acc;
                }, {});

                // Validate stock availability for increased quantities
                const stockEntries = await StockStorage.findAll({
                    where: { itemId: newItemIds },
                    attributes: ['itemId', [sequelize.fn('SUM', sequelize.col('quantity')), 'totalStock']],
                    group: ['itemId'],
                    transaction
                });

                for (const item of items) {
                    const oldQuantity = existingItems[item.itemId] || 0;
                    const quantityDiff = item.issueQuantity - oldQuantity;
                    if (quantityDiff > 0) {
                        const stock = stockEntries.find(se => se.itemId === item.itemId);
                        const totalStock = stock ? parseInt(stock.getDataValue('totalStock')) : 0;
                        if (!stock || quantityDiff > totalStock) {
                            const dbItem = await Item.findByPk(item.itemId);
                            throw new Error(`Insufficient stock for item ${dbItem.itemName} (ID: ${item.itemId}). Requested: ${quantityDiff}, Available: ${totalStock}`);
                        }
                    }
                }

                // Restore stock for removed or reduced items
                for (const existingItem of distribution.items) {
                    const newQuantity = newItems[existingItem.itemId] || 0;
                    const quantityDiff = existingItem.issueQuantity - newQuantity;
                    if (quantityDiff > 0) {
                        const stockRecords = await StockStorage.findAll({
                            where: { itemId: existingItem.itemId },
                            order: [['createdAt', 'DESC']],
                            transaction
                        });
                        if (stockRecords.length > 0) {
                            const latestStock = stockRecords[0];
                            await latestStock.update(
                                { quantity: latestStock.quantity + quantityDiff },
                                { transaction }
                            );
                        } else {
                            await StockStorage.create(
                                { itemId: existingItem.itemId, quantity: quantityDiff },
                                { transaction }
                            );
                        }
                    }
                }

                // Delete existing DistributionItems
                await DistributionItem.destroy({ where: { distributionId: id }, transaction });

                // Create new DistributionItems
                const distributionItems = items.map(item => ({
                    distributionId: id,
                    itemId: item.itemId,
                    issueQuantity: item.issueQuantity
                }));
                await DistributionItem.bulkCreate(distributionItems, { transaction });

                // Deduct stock for new or increased items
                for (const item of items) {
                    const oldQuantity = existingItems[item.itemId] || 0;
                    const quantityDiff = item.issueQuantity - oldQuantity;
                    if (quantityDiff > 0) {
                        let remainingQuantity = quantityDiff;
                        const stockRecords = await StockStorage.findAll({
                            where: { itemId: item.itemId, quantity: { [Op.gt]: 0 } },
                            order: [['createdAt', 'ASC']],
                            transaction
                        });
                        if (!stockRecords || stockRecords.length === 0) {
                            throw new Error(`No available stock for itemId ${item.itemId}`);
                        }
                        for (const stock of stockRecords) {
                            if (remainingQuantity <= 0) break;
                            const deduct = Math.min(remainingQuantity, stock.quantity);
                            await stock.update({ quantity: stock.quantity - deduct }, { transaction });
                            remainingQuantity -= deduct;
                        }
                        if (remainingQuantity > 0) {
                            throw new Error(`Could not deduct full quantity for itemId ${item.itemId}`);
                        }
                    }
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        // Fetch updated distribution
        try {
            const updatedDistribution = await Distribution.findByPk(id, {
                include: [{ model: DistributionItem, as: 'items', include: [{ model: Item, as: 'item', attributes: ['itemName'] }] }]
            });

            if (!updatedDistribution) {
                return res.status(500).json({ message: 'Distribution updated but could not be retrieved' });
            }

            res.status(200).json({
                message: 'Distribution updated successfully',
                data: updatedDistribution
            });
        } catch (fetchError) {
            console.error('Error fetching updated Distribution:', fetchError);
            return res.status(200).json({
                message: 'Distribution updated successfully, but retrieval failed',
                data: { id },
                error: fetchError.message
            });
        }
    } catch (error) {
        console.error('Error updating Distribution:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// GET a Distribution by ID
const getDistributionById = async (req, res) => {
    try {
        const { id } = req.params;
        const distribution = await Distribution.findByPk(id, {
            include: [{ model: DistributionItem, as: 'items', include: [{ model: Item, as: 'item', attributes: ['itemName'] }] }]
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

// Export the functions
module.exports = {
    createDistribution,
    updateDistribution,
    getDistributionById,
    getAllDistributions,
};