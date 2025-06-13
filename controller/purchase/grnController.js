const GRN = require('../../models/purchase/GRN');
const GRNItem = require('../../models/purchase/GRNItem');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const OrderItem = require('../../models/purchase/OrderItem');
const StockStorage = require('../../models/distribution/stockStorage');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;

// GET all GRNs for a Purchase Order
const getAllGRNs = async (req, res) => {
    try {
        const grns = await GRN.findAll({
            include: [{
                model: GRNItem,
                as: 'grnItems',
                include: [{
                    model: OrderItem,
                    as: 'orderItem',
                    include: [{ model: require('../../models/master/item'), as: 'item' }]
                }]
            }]
        });

        res.status(200).json(grns);
    } catch (error) {
        console.error('Error fetching GRNs:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// GET a GRN by ID
const getGRNById = async (req, res) => {
    try {
        const { id } = req.params;
        const grn = await GRN.findOne({
            where: { id: id },
            include: [{
                model: GRNItem,
                as: 'grnItems',
                include: [{
                    model: OrderItem,
                    as: 'orderItem',
                    include: [{ model: require('../../models/master/item'), as: 'item' }]
                }]
            }]
        });

        if (!grn) {
            return res.status(404).json({ message: 'GRN not found for this Purchase Order' });
        }

        res.status(200).json(grn);
    } catch (error) {
        console.error('Error fetching GRN:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Create GRN with Items and Stock Storage
const createGRN = async (req, res) => {
    try {
        const { poId } = req.params;
        const { grnDate = new Date(), challanNo, challanDate, remark, grnItems: grnItemsRaw } = req.body;

        // Validate required fields
        if (!grnDate || !challanNo || !challanDate) {
            return res.status(400).json({ message: 'grnDate, challanNo, and challanDate are required' });
        }

        // Parse grnItems if it's a JSON string
        let grnItems;
        if (typeof grnItemsRaw === 'string') {
            try {
                grnItems = JSON.parse(grnItemsRaw);
            } catch (error) {
                return res.status(400).json({ message: 'Invalid grnItems format: must be a valid JSON array' });
            }
        } else {
            grnItems = grnItemsRaw;
        }

        // Validate grnItems is an array
        if (!Array.isArray(grnItems) || grnItems.length === 0) {
            return res.status(400).json({ message: 'grnItems must be a non-empty array' });
        }

        // Handle multiple file uploads
        let documentPaths = [];
        if (req.files && req.files.documents) {
            const documents = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
            const maxFileSize = 10 * 1024 * 1024; // 10MB

            for (const document of documents) {
                if (!allowedTypes.includes(document.mimetype)) {
                    return res.status(400).json({ message: `Invalid file type for ${document.name}. Only PDF, JPEG, or PNG are allowed.` });
                }
                if (document.size > maxFileSize) {
                    return res.status(400).json({ message: `File ${document.name} exceeds 10MB limit.` });
                }
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const fileExtension = path.extname(document.name);
                const fileName = `grn-document-${uniqueSuffix}${fileExtension}`;
                const filePath = path.join('Uploads', fileName);
                await fs.mkdir(path.join(__dirname, '../../Uploads'), { recursive: true });
                await document.mv(path.join(__dirname, '../../', filePath));
                documentPaths.push(filePath);
            }
        }

        // Check if Purchase Order exists
        const purchaseOrder = await PurchaseOrder.findByPk(poId);
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Generate grnNo in format GRN-DDMMYY-01
        const date = new Date(grnDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const dateString = `${day}${month}${year}`;
        const lastGRN = await GRN.findOne({
            where: { grnNo: { [Op.like]: `GRN-${dateString}-%` } },
            order: [['grnNo', 'DESC']]
        });

        let sequence = 1;
        if (lastGRN) {
            const lastSequence = parseInt(lastGRN.grnNo.split('-')[2], 10);
            sequence = lastSequence + 1;
        }
        const grnNo = `GRN-${dateString}-${String(sequence).padStart(2, '0')}`;

        // Validate OrderItem IDs and fetch itemId and unitId
        const orderItemIds = grnItems.map(item => item.orderItemId);
        const orderItems = await OrderItem.findAll({
            where: { id: orderItemIds, poId },
            include: [{ model: require('../../models/master/item'), as: 'item' }]
        });

        if (orderItems.length !== orderItemIds.length) {
            const invalidIds = orderItemIds.filter(id => !orderItems.some(item => item.id === id));
            return res.status(400).json({ message: `OrderItem IDs not found for PO ${poId}: ${invalidIds.join(', ')}` });
        }

        // Check remaining quantities
        const itemsWithRemainingQuantity = await Promise.all(orderItems.map(async (orderItem) => {
            const previousReceived = await GRNItem.sum('receivedQuantity', {
                where: { orderItemId: orderItem.id }
            });
            const remainingQuantity = orderItem.quantity - (previousReceived || 0);
            return { 
                orderItemId: orderItem.id, 
                remainingQuantity, 
                itemId: orderItem.itemId, 
                unitId: orderItem.unitId // Fetch unitId from OrderItem
            };
        }));

        const validGrnItems = grnItems.filter(item => {
            const itemInfo = itemsWithRemainingQuantity.find(i => i.orderItemId === item.orderItemId);
            return itemInfo && itemInfo.remainingQuantity > 0 && item.receivedQuantity >= 0;
        });

        if (validGrnItems.length === 0) {
            return res.status(400).json({
                message: 'No valid items to receive. All items are either fully received or have invalid received quantities.'
            });
        }

        // Generate storeCode for each GRNItem in format item-DDMMYY-N
        const storeCodePromises = validGrnItems.map(async (item) => {
            const lastStoreCode = await GRNItem.findOne({
                where: { storeCode: { [Op.like]: `item-${dateString}-%` } },
                order: [['storeCode', 'DESC']]
            });
            let storeSequence = 1;
            if (lastStoreCode) {
                const lastStoreSequence = parseInt(lastStoreCode.storeCode.split('-')[2], 10);
                storeSequence = lastStoreSequence + 1;
            }
            return `item-${dateString}-${storeSequence}`;
        });
        const storeCodes = await Promise.all(storeCodePromises);

        const transaction = await sequelize.transaction();
        let createdGRN;
        try {
            // Create GRN
            const grn = await GRN.create({
                poId,
                grnNo,
                grnDate,
                challanNo,
                challanDate,
                document: documentPaths.length > 0 ? documentPaths : null,
                remark
            }, { transaction });

            // Create GRN Items with itemId, unitId, and storeCode
            const grnItemData = await Promise.all(validGrnItems.map(async (item, index) => {
                const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                const previousReceived = await GRNItem.sum('receivedQuantity', {
                    where: { orderItemId: item.orderItemId },
                    transaction
                });
                const remainingQuantity = orderItem.quantity - (previousReceived || 0);

                const receivedQuantity = Math.min(item.receivedQuantity, remainingQuantity);
                const rejectedQuantity = item.rejectedQuantity || (remainingQuantity - receivedQuantity);

                // Validate receivedQuantity
                if (receivedQuantity < 0) {
                    throw new Error(`Invalid receivedQuantity (${receivedQuantity}) for orderItemId: ${item.orderItemId}`);
                }

                return {
                    grnId: grn.id,
                    orderItemId: item.orderItemId,
                    itemId: orderItem.itemId,
                    unitId: orderItem.unitId, // Use unitId from OrderItem
                    storeCode: storeCodes[index], // Assign generated storeCode
                    receivedQuantity,
                    rejectedQuantity
                };
            }));

            await GRNItem.bulkCreate(grnItemData, { transaction });

            // Stock Update in StockStorage
            for (const item of grnItemData) {
                const stockRecord = await StockStorage.findOne({
                    where: {
                        poId,
                        grnId: grn.id,
                        itemId: item.itemId
                    },
                    transaction
                });

                if (stockRecord) {
                    await stockRecord.update({
                        quantity: stockRecord.quantity + item.receivedQuantity,
                        remark: remark || stockRecord.remark
                    }, { transaction });
                } else {
                    await StockStorage.create({
                        poId,
                        grnId: grn.id,
                        qGRNId: null,
                        storeCode: item.storeCode,
                        unitId: item.unitId,
                        itemId: item.itemId,
                        quantity: item.receivedQuantity,
                        remark: remark || null
                    }, { transaction });
                }
            }

            await transaction.commit();

            // Fetch the created GRN after transaction commit
            createdGRN = await GRN.findByPk(grn.id, {
                include: [{
                    model: GRNItem,
                    as: 'grnItems',
                    include: [{
                        model: OrderItem,
                        as: 'orderItem',
                        include: [{ model: require('../../models/master/item'), as: 'item' }]
                    }]
                }]
            });
        } catch (error) {
            await transaction.rollback();
            // Clean up uploaded files if transaction fails
            if (documentPaths.length > 0) {
                for (const docPath of documentPaths) {
                    try {
                        await fs.unlink(path.join(__dirname, '../../', docPath));
                    } catch (unlinkError) {
                        console.error(`Failed to delete uploaded file: ${docPath}`, unlinkError);
                    }
                }
            }
            throw error;
        }

        res.status(201).json(createdGRN);
    } catch (error) {
        console.error('Error creating GRN:', error, error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Update GRN
const updateGRN = async (req, res) => {
    try {
        const { grnId } = req.params;
        const {
            grnNo,
            grnDate,
            challanNo,
            challanDate,
            remark,
            grnItems: grnItemsRaw,
            existingDocuments
        } = req.body;

        // Parse grnItems if it's a JSON string
        let grnItems;
        if (typeof grnItemsRaw === 'string') {
            try {
                grnItems = JSON.parse(grnItemsRaw);
            } catch (error) {
                return res.status(400).json({ message: 'Invalid grnItems format: must be a valid JSON array' });
            }
        } else {
            grnItems = grnItemsRaw;
        }

        const grn = await GRN.findByPk(grnId, {
            include: [{ model: GRNItem, as: 'grnItems' }],
        });
        if (!grn) {
            return res.status(404).json({ message: 'GRN not found' });
        }

        // Handle multiple file uploads
        let documentPaths = existingDocuments ? (Array.isArray(existingDocuments) ? existingDocuments : JSON.parse(existingDocuments)) : [];
        if (req.files && req.files.documents) {
            const documents = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
            const maxFileSize = 10 * 1024 * 1024; // 10MB

            for (const document of documents) {
                if (!allowedTypes.includes(document.mimetype)) {
                    return res.status(400).json({ message: `Invalid file type for ${document.name}. Only PDF, JPEG, or PNG are allowed.` });
                }
                if (document.size > maxFileSize) {
                    return res.status(400).json({ message: `File ${document.name} exceeds 10MB limit.` });
                }
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const fileExtension = path.extname(document.name);
                const fileName = `grn-document-${uniqueSuffix}${fileExtension}`;
                const filePath = path.join('Uploads', fileName);
                await fs.mkdir(path.join(__dirname, '../../Uploads'), { recursive: true });
                await document.mv(path.join(__dirname, '../../', filePath));
                documentPaths.push(filePath);
            }
        }

        // Delete old files that are no longer referenced
        const oldDocuments = grn.document || [];
        const documentsToDelete = oldDocuments.filter(doc => !documentPaths.includes(doc));
        for (const doc of documentsToDelete) {
            try {
                await fs.unlink(path.join(__dirname, '../../', doc));
            } catch (err) {
                console.warn(`Failed to delete old file: ${doc}`, err);
            }
        }

        // Generate storeCode for new GRNItems in format item-DDMMYY-N
        const date = new Date(grnDate || grn.grnDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const dateString = `${day}${month}${year}`;

        const transaction = await sequelize.transaction();
        try {
            await grn.update(
                {
                    grnNo: grnNo ?? grn.grnNo,
                    grnDate: grnDate ?? grn.grnDate,
                    challanNo: challanNo ?? grn.challanNo,
                    challanDate: challanDate ?? grn.challanDate,
                    document: documentPaths.length > 0 ? documentPaths : null,
                    remark: remark !== undefined ? remark : grn.remark,
                },
                { transaction }
            );

            if (grnItems && grnItems.length > 0) {
                const existingGRNItemIds = grn.grnItems.map((item) => item.id);
                const providedGRNItemIds = grnItems
                    .filter((item) => item.id)
                    .map((item) => item.id);

                const grnItemsToDelete = existingGRNItemIds.filter(
                    (id) => !providedGRNItemIds.includes(id)
                );
                if (grnItemsToDelete.length > 0) {
                    const deletedGRNItems = grn.grnItems.filter((item) =>
                        grnItemsToDelete.includes(item.id)
                    );
                    for (const item of deletedGRNItems) {
                        const orderItem = await OrderItem.findByPk(item.orderItemId, { transaction });
                        if (orderItem) {
                            const stock = await StockStorage.findOne({
                                where: { grnId: grn.id, itemId: item.itemId },
                                transaction,
                            });
                            if (stock) {
                                stock.quantity -= item.receivedQuantity;
                                if (stock.quantity <= 0) {
                                    await stock.destroy({ transaction });
                                } else {
                                    await stock.save({ transaction });
                                }
                            }
                        }
                    }
                    await GRNItem.destroy({
                        where: { id: grnItemsToDelete },
                        transaction,
                    });
                }

                // Generate storeCodes for new items
                const newGrnItems = grnItems.filter(item => !item.id);
                const storeCodePromises = newGrnItems.map(async () => {
                    const lastStoreCode = await GRNItem.findOne({
                        where: { storeCode: { [Op.like]: `item-${dateString}-%` } },
                        order: [['storeCode', 'DESC']],
                        transaction
                    });
                    let storeSequence = 1;
                    if (lastStoreCode) {
                        const lastStoreSequence = parseInt(lastStoreCode.storeCode.split('-')[2], 10);
                        storeSequence = lastStoreSequence + 1;
                    }
                    return `item-${dateString}-${storeSequence}`;
                });
                const storeCodes = await Promise.all(storeCodePromises);
                let storeCodeIndex = 0;

                for (const item of grnItems) {
                    const orderItem = await OrderItem.findByPk(item.orderItemId, {
                        transaction,
                        include: [{ model: require('../../models/master/item'), as: 'item' }]
                    });
                    if (!orderItem || orderItem.poId !== grn.poId) {
                        await transaction.rollback();
                        return res.status(400).json({
                            message: `Invalid orderItemId: ${item.orderItemId} does not belong to poId: ${grn.poId}`,
                        });
                    }

                    const prevReceived = await GRNItem.sum('receivedQuantity', {
                        where: { orderItemId: item.orderItemId, id: { [Op.ne]: item.id || 0 } },
                        transaction,
                    });
                    const remainingQuantity = orderItem.quantity - (prevReceived || 0);
                    if (item.receivedQuantity > remainingQuantity) {
                        await transaction.rollback();
                        return res.status(400).json({
                            message: `Received quantity (${item.receivedQuantity}) exceeds remaining quantity (${remainingQuantity}) for orderItemId: ${item.orderItemId}`,
                        });
                    }

                    const rejectedQuantity = item.rejectedQuantity || (remainingQuantity - item.receivedQuantity);

                    const grnItemData = {
                        grnId: grn.id,
                        orderItemId: item.orderItemId,
                        itemId: orderItem.itemId,
                        unitId: orderItem.unitId, // Use unitId from OrderItem
                        storeCode: item.id ? (grn.grnItems.find(gi => gi.id === item.id)?.storeCode || storeCodes[storeCodeIndex++]) : storeCodes[storeCodeIndex++],
                        receivedQuantity: item.receivedQuantity,
                        rejectedQuantity,
                    };

                    if (item.id) {
                        const existingGRNItem = grn.grnItems.find((gi) => gi.id === item.id);
                        if (!existingGRNItem) {
                            await transaction.rollback();
                            return res.status(400).json({
                                message: `GRNItem with id: ${item.id} not found for grnId: ${grnId}`,
                            });
                        }

                        const quantityDifference = item.receivedQuantity - existingGRNItem.receivedQuantity;
                        if (quantityDifference !== 0) {
                            const stock = await StockStorage.findOne({
                                where: { grnId: grn.id, itemId: orderItem.itemId },
                                transaction,
                            });
                            if (stock) {
                                stock.quantity += quantityDifference;
                                stock.remark = remark || stock.remark;
                                if (stock.quantity <= 0) {
                                    await stock.destroy({ transaction });
                                } else {
                                    await stock.save({ transaction });
                                }
                            } else if (quantityDifference > 0) {
                                await StockStorage.create(
                                    {
                                        poId: grn.poId,
                                        grnId: grn.id,
                                        qGRNId: null,
                                        itemId: orderItem.itemId,
                                        quantity: quantityDifference,
                                        remark: remark || null,
                                    },
                                    { transaction }
                                );
                            }
                        }

                        await GRNItem.update(grnItemData, {
                            where: { id: item.id, grnId: grn.id },
                            transaction,
                        });
                    } else {
                        const newGRNItem = await GRNItem.create(grnItemData, { transaction });

                        const stock = await StockStorage.findOne({
                            where: { grnId: grn.id, itemId: orderItem.itemId },
                            transaction,
                        });
                        if (stock) {
                            stock.quantity += item.receivedQuantity;
                            stock.remark = remark || stock.remark;
                            await stock.save({ transaction });
                        } else {
                            await StockStorage.create(
                                {
                                    poId: grn.poId,
                                    grnId: grn.id,
                                    qGRNId: null,
                                    storeCode: newGRNItem.storeCode,
                                    unitId: orderItem.unitId,
                                    itemId: orderItem.itemId,
                                    quantity: item.receivedQuantity,
                                    remark: remark || null,
                                },
                                { transaction }
                            );
                        }
                    }
                }
            } else {
                for (const item of grn.grnItems) {
                    const orderItem = await OrderItem.findByPk(item.orderItemId, { transaction });
                    if (orderItem) {
                        const stock = await StockStorage.findOne({
                            where: { grnId: grn.id, itemId: item.itemId },
                            transaction,
                        });
                        if (stock) {
                            stock.quantity -= item.receivedQuantity;
                            if (stock.quantity <= 0) {
                                await stock.destroy({ transaction });
                            } else {
                                await stock.save({ transaction });
                            }
                        }
                    }
                }
                await GRNItem.destroy({ where: { grnId }, transaction });
            }

            await transaction.commit();

            const updatedGRN = await GRN.findByPk(grnId, {
                include: [{
                    model: GRNItem,
                    as: 'grnItems',
                    include: [{
                        model: OrderItem,
                        as: 'orderItem',
                        include: [{ model: require('../../models/master/item'), as: 'item' }]
                    }]
                }],
            });

            res.status(200).json(updatedGRN);
        } catch (error) {
            await transaction.rollback();
            // Clean up new files if transaction fails
            const newFiles = documentPaths.filter(doc => !oldDocuments.includes(doc));
            for (const doc of newFiles) {
                try {
                    await fs.unlink(path.join(__dirname, '../../', doc));
                } catch (unlinkError) {
                    console.error(`Failed to delete new file: ${doc}`, unlinkError);
                }
            }
            throw error;
        }
    } catch (error) {
        console.error('Error updating GRN:', error, error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// DELETE a GRN
const deleteGRN = async (req, res) => {
    try {
        const { grnId } = req.params;

        const grn = await GRN.findByPk(grnId);
        if (!grn) {
            return res.status(404).json({ message: 'GRN not found' });
        }

        const transaction = await sequelize.transaction();
        try {
            const grnItems = await GRNItem.findAll({ where: { grnId }, transaction });

            for (const item of grnItems) {
                const orderItem = await OrderItem.findByPk(item.orderItemId, { transaction });

                if (orderItem) {
                    const stock = await StockStorage.findOne({
                        where: {
                            grnId: grn.id,
                            itemId: item.itemId
                        },
                        transaction
                    });

                    if (stock) {
                        stock.quantity -= item.receivedQuantity;
                        if (stock.quantity <= 0) {
                            await stock.destroy({ transaction });
                        } else {
                            await stock.save({ transaction });
                        }
                    }
                }
            }

            // Delete associated files
            if (grn.document && Array.isArray(grn.document)) {
                for (const doc of grn.document) {
                    try {
                        await fs.unlink(path.join(__dirname, '../../', doc));
                    } catch (err) {
                        console.warn(`Failed to delete file: ${doc}`, err);
                    }
                }
            }

            await GRNItem.destroy({ where: { grnId }, transaction });
            await grn.destroy({ transaction });

            await transaction.commit();
            res.status(200).json({ message: 'GRN and associated stock deleted successfully' });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error deleting GRN:', error, error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = {
    createGRN,
    updateGRN,
    deleteGRN,
    getGRNById,
    getAllGRNs
};