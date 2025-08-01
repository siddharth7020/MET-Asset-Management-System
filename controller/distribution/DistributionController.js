const { Op } = require('sequelize');
const Distribution = require('../../models/distribution/Distribution');
const DistributionItem = require('../../models/distribution/DistributionItem');
const Item = require('../../models/master/item');
const Unit = require('../../models/master/unit');
const StockStorage = require('../../models/distribution/stockStorage');
const FinancialYear = require('../../models/master/financialYear');
const Institute = require('../../models/master/institute');
const Location = require('../../models/master/location');
const sequelize = require('../../config/database');
const path = require('path');
const fs = require('fs').promises;

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, '../../Uploads');
fs.mkdir(uploadDir, { recursive: true }).catch(err => console.error('Error creating uploads directory:', err));

// GET all Distributions
const getAllDistributions = async (req, res) => {
    try {
        const distributions = await Distribution.findAll({
            include: [
                { 
                    model: DistributionItem, 
                    as: 'items', 
                    include: [
                        { model: Item, as: 'item', attributes: ['itemName'] },
                        { model: Unit, as: 'unit', attributes: ['uniteCode'] }
                    ]
                },
                { model: Location, as: 'locationData', attributes: ['locationID', 'floor', 'room'] }
            ]
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
            floor,
            rooms,
            distributionDate = new Date(),
            remark,
            items,
            existingDocuments
        } = req.body;

        // Parse items if sent as a string
        let parsedItems = items;
        if (typeof items === 'string') {
            try {
                parsedItems = JSON.parse(items);
            } catch (error) {
                return res.status(400).json({ message: 'Invalid items format, must be a valid JSON array' });
            }
        }

        // Validate required fields
        if (!financialYearId || !instituteId || !employeeName || !location || !floor || !rooms || typeof rooms !== 'string' || !distributionDate || !parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
            return res.status(400).json({ message: 'financialYearId, instituteId, employeeName, location, floor, rooms (string), distributionDate, and items are required' });
        }

        // Validate distributionDate
        if (isNaN(Date.parse(distributionDate))) {
            return res.status(400).json({ message: 'Invalid distributionDate format' });
        }

        // Validate location and rooms
        const locationRecord = await Location.findByPk(location);
        if (!locationRecord) {
            return res.status(404).json({ message: `Location with ID ${location} not found` });
        }
        if (!locationRecord.room.includes(rooms)) {
            return res.status(400).json({ message: `Room '${rooms}' is not available in the selected location` });
        }
        if (floor !== locationRecord.floor) {
            return res.status(400).json({ message: `Floor '${floor}' does not match the location's floor '${locationRecord.floor}'` });
        }

        // Generate distributionNo in format DIS-DDMMYY-01
        const date = new Date(distributionDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const dateString = `${day}${month}${year}`;

        const lastDistribution = await Distribution.findOne({
            where: {
                distributionNo: {
                    [Op.like]: `DIS-${dateString}-%`
                }
            },
            order: [['distributionNo', 'DESC']]
        });

        let sequence = 1;
        if (lastDistribution && lastDistribution.distributionNo) {
            const parts = lastDistribution.distributionNo.split('-');
            if (parts.length === 3 && !isNaN(parts[2])) {
                sequence = parseInt(parts[2], 10) + 1;
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

        // Validate items, unitId, and stock availability
        const itemIds = parsedItems.map(item => item.itemId);
        const unitIds = parsedItems.map(item => item.unitId).filter(id => id !== undefined);
        const stockEntries = await StockStorage.findAll({
            where: { itemId: itemIds },
            attributes: ['itemId', [sequelize.fn('SUM', sequelize.col('quantity')), 'totalStock']],
            group: ['itemId']
        });

        for (const item of parsedItems) {
            if (!item.itemId || !item.unitId || !item.issueQuantity || item.issueQuantity <= 0) {
                return res.status(400).json({ message: `Invalid item data: itemId, unitId, and issueQuantity are required and issueQuantity must be > 0 for itemId ${item.itemId}` });
            }

            const dbItem = await Item.findByPk(item.itemId);
            if (!dbItem) {
                return res.status(404).json({ message: `Item with ID ${item.itemId} not found` });
            }

            const dbUnit = await Unit.findByPk(item.unitId);
            if (!dbUnit) {
                return res.status(404).json({ message: `Unit with ID ${item.unitId} not found` });
            }

            const stock = stockEntries.find(se => se.itemId === item.itemId);
            const totalStock = stock ? parseInt(stock.getDataValue('totalStock')) : 0;
            if (!stock || item.issueQuantity > totalStock) {
                return res.status(400).json({
                    message: `Insufficient stock for item ${dbItem.itemName} (ID: ${item.itemId}). Requested: ${item.issueQuantity}, Available: ${totalStock}`
                });
            }
        }

        // Handle file uploads
        let document = [];
        if (existingDocuments) {
            try {
                document = JSON.parse(existingDocuments);
                if (!Array.isArray(document)) {
                    console.warn('existingDocuments is not an array:', document);
                    document = [];
                }
            } catch (error) {
                console.error('Error parsing existingDocuments:', error);
                document = [];
            }
        }
        console.log('Initial document array:', document); // Debugging

        if (req.files && req.files.documents) {
            const files = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
            console.log('Uploaded files:', files); // Debugging
            for (const file of files) {
                if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('application/pdf')) {
                    return res.status(400).json({ message: `Invalid file type for ${file.name}. Only images and PDFs are allowed.` });
                }
                const fileName = `${Date.now()}-${file.name}`;
                const filePath = path.join(uploadDir, fileName);
                await file.mv(filePath);
                document.push(`/uploads/${fileName}`);
            }
        }
        console.log('Final document array before saving:', document); // Debugging

        let distribution;
        const transaction = await sequelize.transaction();
        try {
            // Create Distribution
            distribution = await Distribution.create({
                financialYearId,
                instituteId,
                employeeName,
                location,
                floor,
                rooms,
                distributionDate,
                distributionNo,
                document, // Changed from documents to document
                remark
            }, { transaction });
            console.log('Distribution created with document:', distribution.document); // Debugging

            // Create Distribution Items
            const distributionItems = parsedItems.map(item => ({
                distributionId: distribution.id,
                itemId: item.itemId,
                unitId: item.unitId,
                issueQuantity: item.issueQuantity
            }));
            await DistributionItem.bulkCreate(distributionItems, { transaction });

            // Deduct stock from StockStorage
            for (const item of parsedItems) {
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
            // Delete uploaded files if transaction fails
            for (const doc of document) {
                if (typeof doc === 'string' && doc.startsWith('/uploads/')) {
                    try {
                        await fs.unlink(path.join(__dirname, '../../', doc));
                    } catch (unlinkError) {
                        console.error(`Error deleting file ${doc}:`, unlinkError);
                    }
                }
            }
            throw error;
        }

        // Fetch created distribution after commit
        try {
            const createdDistribution = await Distribution.findByPk(distribution.id, {
                include: [
                    { 
                        model: DistributionItem, 
                        as: 'items', 
                        include: [
                            { model: Item, as: 'item', attributes: ['itemName'] },
                            { model: Unit, as: 'unit', attributes: ['uniteCode'] }
                        ]
                    },
                    { model: Location, as: 'locationData', attributes: ['locationID', 'floor', 'room'] }
                ]
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
        const { financialYearId, instituteId, employeeName, location, floor, rooms, distributionDate, distributionNo, remark, items, existingDocuments } = req.body;

        // Parse items if sent as a string
        let parsedItems = items;
        if (typeof items === 'string') {
            try {
                parsedItems = JSON.parse(items);
            } catch (error) {
                return res.status(400).json({ message: 'Invalid items format, must be a valid JSON array' });
            }
        }

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
        if (location) {
            const locationRecord = await Location.findByPk(location);
            if (!locationRecord) {
                return res.status(404).json({ message: `Location with ID ${location} not found` });
            }
            if (rooms && typeof rooms === 'string') {
                if (!locationRecord.room.includes(rooms)) {
                    return res.status(400).json({ message: `Room '${rooms}' is not available in the selected location` });
                }
            }
            if (floor && floor !== locationRecord.floor) {
                return res.status(400).json({ message: `Floor '${floor}' does not match the location's floor '${locationRecord.floor}'` });
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
        if (parsedItems && Array.isArray(parsedItems)) {
            if (parsedItems.length === 0) {
                return res.status(400).json({ message: 'Items array cannot be empty' });
            }
            newItemIds = parsedItems.map(item => item.itemId);
            for (const item of parsedItems) {
                if (!item.itemId || !item.unitId || !item.issueQuantity || item.issueQuantity <= 0) {
                    return res.status(400).json({ message: `Invalid item data: itemId, unitId, and issueQuantity are required and issueQuantity must be > 0 for itemId ${item.itemId}` });
                }
                const dbItem = await Item.findByPk(item.itemId);
                if (!dbItem) {
                    return res.status(404).json({ message: `Item with ID ${item.itemId} not found` });
                }
                const dbUnit = await Unit.findByPk(item.unitId);
                if (!dbUnit) {
                    return res.status(404).json({ message: `Unit with ID ${item.unitId} not found` });
                }
            }
        }

        // Handle file uploads
        let document = [];
        if (existingDocuments) {
            try {
                document = JSON.parse(existingDocuments);
                if (!Array.isArray(document)) {
                    console.warn('existingDocuments is not an array:', document);
                    document = [];
                }
            } catch (error) {
                console.error('Error parsing existingDocuments:', error);
                document = distribution.document || [];
            }
        } else {
            document = distribution.document || [];
        }
        console.log('Initial document array:', document); // Debugging

        if (req.files && req.files.documents) {
            const files = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
            console.log('Uploaded files:', files); // Debugging
            for (const file of files) {
                if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('application/pdf')) {
                    return res.status(400).json({ message: `Invalid file type for ${file.name}. Only images and PDFs are allowed.` });
                }
                const fileName = `${Date.now()}-${file.name}`;
                const filePath = path.join(uploadDir, fileName);
                await file.mv(filePath);
                document.push(`/uploads/${fileName}`);
            }
        }
        console.log('Final document array before saving:', document); // Debugging

        const transaction = await sequelize.transaction();
        try {
            // Update Distribution fields
            await distribution.update({
                financialYearId: financialYearId || distribution.financialYearId,
                instituteId: instituteId || distribution.instituteId,
                employeeName: employeeName || distribution.employeeName,
                location: location || distribution.location,
                floor: floor || distribution.floor,
                rooms: rooms || distribution.rooms,
                distributionDate: distributionDate || distribution.distributionDate,
                distributionNo: distributionNo || distribution.distributionNo,
                document, // Changed from documents to document
                remark: remark !== undefined ? remark : distribution.remark
            }, { transaction });
            console.log('Distribution updated with document:', distribution.document); // Debugging

            // Handle items update if provided
            if (parsedItems && Array.isArray(parsedItems)) {
                // Calculate stock adjustments
                const existingItems = distribution.items.reduce((acc, item) => {
                    acc[item.itemId] = { issueQuantity: item.issueQuantity, unitId: item.unitId };
                    return acc;
                }, {});
                const newItems = parsedItems.reduce((acc, item) => {
                    acc[item.itemId] = { issueQuantity: item.issueQuantity, unitId: item.unitId };
                    return acc;
                }, {});

                // Validate stock availability for increased quantities
                const stockEntries = await StockStorage.findAll({
                    where: { itemId: newItemIds },
                    attributes: ['itemId', [sequelize.fn('SUM', sequelize.col('quantity')), 'totalStock']],
                    group: ['itemId'],
                    transaction
                });

                for (const item of parsedItems) {
                    const oldQuantity = existingItems[item.itemId]?.issueQuantity || 0;
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
                    const newQuantity = newItems[existingItem.itemId]?.issueQuantity || 0;
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
                const distributionItems = parsedItems.map(item => ({
                    distributionId: id,
                    itemId: item.itemId,
                    unitId: item.unitId,
                    issueQuantity: item.issueQuantity
                }));
                await DistributionItem.bulkCreate(distributionItems, { transaction });

                // Deduct stock for new or increased items
                for (const item of parsedItems) {
                    const oldQuantity = existingItems[item.itemId]?.issueQuantity || 0;
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
            // Delete newly uploaded files if transaction fails
            for (const doc of document) {
                if (typeof doc === 'string' && doc.startsWith('/uploads/')) {
                    try {
                        await fs.unlink(path.join(__dirname, '../../', doc));
                    } catch (unlinkError) {
                        console.error(`Error deleting file ${doc}:`, unlinkError);
                    }
                }
            }
            throw error;
        }

        // Fetch updated distribution
        try {
            const updatedDistribution = await Distribution.findByPk(id, {
                include: [
                    { 
                        model: DistributionItem, 
                        as: 'items', 
                        include: [
                            { model: Item, as: 'item', attributes: ['itemName'] },
                            { model: Unit, as: 'unit', attributes: ['uniteCode'] }
                        ]
                    },
                    { model: Location, as: 'locationData', attributes: ['locationID', 'floor', 'room'] }
                ]
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
            include: [
                { 
                    model: DistributionItem, 
                    as: 'items', 
                    include: [
                        { model: Item, as: 'item', attributes: ['itemName'] },
                        { model: Unit, as: 'unit', attributes: ['uniteCode'] }
                    ]
                },
                { model: Location, as: 'locationData', attributes: ['locationID', 'floor', 'room'] }
            ]
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
