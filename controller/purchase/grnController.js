const GRN = require('../../models/purchase/GRN');
const GRNItem = require('../../models/purchase/GRNItem');
const QuickGRNItem = require('../../models/purchase/quickGRNItem');
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

// Function to generate the next storeCode sequence
const getNextStoreCodeSequence = async (dateString, count = 1, transaction = null) => {
    try {
        // Validate dateString format (DDMMYY)
        if (!dateString || !/^\d{6}$/.test(dateString)) {
            throw new Error('Invalid dateString format. Expected DDMMYY.');
        }

        // Define the pattern for storeCode (e.g., Item-%)
        const storeCodePattern = `Item-%`;

        // Query the highest sequence from GRNItem
        const lastGRNItem = await GRNItem.findOne({
            where: { storeCode: { [Op.like]: storeCodePattern } },
            order: [['storeCode', 'DESC']],
            transaction
        });

        // Query the highest sequence from QuickGRNItem
        const lastQuickGRNItem = await QuickGRNItem.findOne({
            where: { storeCode: { [Op.like]: storeCodePattern } },
            order: [['storeCode', 'DESC']],
            transaction
        });

        // Extract sequence numbers
        const sequences = [];

        if (lastGRNItem && lastGRNItem.storeCode) {
            const parts = lastGRNItem.storeCode.split('-');
            if (parts.length === 3) {
                const lastSequence = parseInt(parts[2], 10);
                if (!isNaN(lastSequence)) {
                    sequences.push(lastSequence);
                }
            }
        }

        if (lastQuickGRNItem && lastQuickGRNItem.storeCode) {
            const parts = lastQuickGRNItem.storeCode.split('-');
            if (parts.length === 3) {
                const lastSequence = parseInt(parts[2], 10);
                if (!isNaN(lastSequence)) {
                    sequences.push(lastSequence);
                }
            }
        }

        // Determine the starting sequence number
        const startSequence = sequences.length > 0 ? Math.max(...sequences) + 1 : 1;

        // Generate storeCodes for the requested count
        const storeCodes = Array.from({ length: count }, (_, index) => {
            const nextSequence = startSequence + index;
            return `Item-${dateString}-${nextSequence}`;
        });

        return storeCodes;
    } catch (error) {
        console.error('Error generating next storeCode sequence:', error);
        throw error;
    }
};

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

        // Generate GRN number in format GRN-DDMMYY-XX
        const date = new Date(grnDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const dateString = `${day}${month}${year}`;

        // Scope the GRN sequence to the specific date
        const likePattern = `GRN-${dateString}-%`;

        const lastGrn = await GRN.findOne({
            where: { grnNo: { [Op.like]: likePattern } },
            order: [['grnNo', 'DESC']]
        });

        let sequence = 1;
        if (lastGrn && lastGrn.grnNo) {
            const parts = lastGrn.grnNo.split('-');
            if (parts.length === 3) {
                const lastSeq = parseInt(parts[2], 10);
                if (!isNaN(lastSeq)) {
                    sequence = lastSeq + 1;
                } else {
                    console.warn(`Invalid GRN format found: ${lastGrn.grnNo}. Starting sequence at 1.`);
                }
            } else {
                console.warn(`Unexpected GRN format: ${lastGrn.grnNo}`);
            }
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
                unitId: orderItem.unitId
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

        // Start transaction
        const transaction = await sequelize.transaction();

        // Generate storeCodes for all items in this GRN
        const storeCodes = await getNextStoreCodeSequence(dateString, validGrnItems.length, transaction);

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
                    unitId: orderItem.unitId,
                    storeCode: storeCodes[index],
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


module.exports = {
    createGRN,
    getGRNById,
    getAllGRNs
};