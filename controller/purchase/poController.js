const sequelize = require('../../config/database');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const OrderItem = require('../../models/purchase/OrderItem');
const GRN = require('../../models/purchase/GRN');
const GRNItem = require('../../models/purchase/GRNItem');
const  StockStorage = require('../../models/distribution/stockStorage');
const Item = require('../../models/master/item');
const Distribution = require('../../models/distribution/Distribution');
const DistributionItem = require('../../models/distribution/DistributionItem');
const FinancialYear = require('../../models/master/financialYear');
const Institute = require('../../models/master/institute');

// CREATE a new Purchase Order with Order Items
const createPurchaseOrder = async (req, res) => {
    try {
        const {
            poDate,
            poNo,
            instituteId,
            financialYearId,
            vendorId,
            document,
            requestedBy,
            remark,
            orderItems // Array of { itemId, quantity, rate, discount, tax1, tax2 }
        } = req.body;

        // Create Purchase Order
        const purchaseOrder = await PurchaseOrder.create({
            poDate,
            poNo,
            instituteId,
            financialYearId,
            vendorId,
            document,
            requestedBy,
            remark
        });

        // Create associated Order Items
        if (orderItems && orderItems.length > 0) {
            const orderItemData = orderItems.map(item => ({
                poId: purchaseOrder.poId,
                itemId: item.itemId,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.quantity * item.rate,
                discount: item.discount || 0,
                tax1: item.tax1 || 0,
                tax2: item.tax2 || 0,
                totalTax: (item.tax1 || 0) + (item.tax2 || 0),
                totalAmount: (item.quantity * item.rate) - (item.discount || 0) + ((item.tax1 || 0) + (item.tax2 || 0))
            }));
            await OrderItem.bulkCreate(orderItemData);
        }

        // Fetch the created Purchase Order with its Order Items
        const createdOrder = await PurchaseOrder.findByPk(purchaseOrder.poId, {
            include: [{ model: OrderItem, as: 'orderItems' }]
        });

        res.status(201).json(createdOrder);
    } catch (error) {
        console.error('Error creating Purchase Order:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// READ all Purchase Orders
const getAllPurchaseOrders = async (req, res) => {
    try {
        const purchaseOrders = await PurchaseOrder.findAll({
            include: [
                { model: OrderItem, as: 'orderItems' },
                { model: GRN, as: 'grns', include: [{ model: GRNItem, as: 'grnItems' }] }
            ]
        });
        res.status(200).json(purchaseOrders);
    } catch (error) {
        console.error('Error fetching Purchase Orders:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// READ a single Purchase Order by poId
const getPurchaseOrderById = async (req, res) => {
    try {
        const { poId } = req.params;
        const purchaseOrder = await PurchaseOrder.findByPk(poId, {
            include: [
                { model: OrderItem, as: 'orderItems' },
                { model: GRN, as: 'grns', include: [{ model: GRNItem, as: 'grnItems' }] }
            ]
        });

        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        res.status(200).json(purchaseOrder);
    } catch (error) {
        console.error('Error fetching Purchase Order:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// UPDATE a Purchase Order
const updatePurchaseOrder = async (req, res) => {
    try {
        const { poId } = req.params;
        const {
            poDate,
            poNo,
            instituteId,
            financialYearId,
            vendorId,
            document,
            requestedBy,
            remark,
            orderItems // Updated array of Order Items
        } = req.body;

        const purchaseOrder = await PurchaseOrder.findByPk(poId);
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Update Purchase Order details
        await purchaseOrder.update({
            poDate,
            poNo,
            instituteId,
            financialYearId,
            vendorId,
            document,
            requestedBy,
            remark
        });

        // Update or recreate Order Items
        if (orderItems && orderItems.length > 0) {
            // Delete existing Order Items
            await OrderItem.destroy({ where: { poId } });

            // Create new Order Items
            const orderItemData = orderItems.map(item => ({
                poId: purchaseOrder.poId,
                itemId: item.itemId,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.quantity * item.rate,
                discount: item.discount || 0,
                tax1: item.tax1 || 0,
                tax2: item.tax2 || 0,
                totalTax: (item.tax1 || 0) + (item.tax2 || 0),
                totalAmount: (item.quantity * item.rate) - (item.discount || 0) + ((item.tax1 || 0) + (item.tax2 || 0))
            }));
            await OrderItem.bulkCreate(orderItemData);
        }

        // Fetch updated Purchase Order
        const updatedOrder = await PurchaseOrder.findByPk(poId, {
            include: [{ model: OrderItem, as: 'orderItems' }]
        });

        res.status(200).json(updatedOrder);
    } catch (error) {
        console.error('Error updating Purchase Order:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// DELETE a Purchase Order
const deletePurchaseOrder = async (req, res) => {
    try {
        const { poId } = req.params;
        const purchaseOrder = await PurchaseOrder.findByPk(poId);

        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Delete associated Order Items and GRNs (cascade will handle this if configured in DB)
        await purchaseOrder.destroy();
        res.status(200).json({ message: 'Purchase Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting Purchase Order:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// CREATE a GRN for a Purchase Order
const createGRN = async (req, res) => {
    try {
        const { poId } = req.params;
        const { grnNo, grnDate, challanNo, challanDate, document, remark, grnItems } = req.body;

        if (!grnNo || !grnDate || !challanNo || !challanDate) {
            return res.status(400).json({ message: 'grnNo, grnDate, challanNo, and challanDate are required' });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(poId);
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (grnItems && grnItems.length > 0) {
            const orderItemIds = grnItems.map(item => item.orderItemId);
            const orderItems = await OrderItem.findAll({
                where: { id: orderItemIds, poId }
            });

            if (orderItems.length !== orderItemIds.length) {
                const invalidIds = orderItemIds.filter(id => !orderItems.some(item => item.id === id));
                return res.status(400).json({
                    message: `OrderItem IDs not found for Purchase Order ${poId}: ${invalidIds.join(', ')}`
                });
            }

            for (const item of grnItems) {
                const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                if (item.receivedQuantity > orderItem.quantity) {
                    return res.status(400).json({
                        message: `Received quantity (${item.receivedQuantity}) exceeds ordered quantity (${orderItem.quantity}) for OrderItem ${item.orderItemId}`
                    });
                }
            }
        }

        const transaction = await sequelize.transaction();
        try {
            const grn = await GRN.create({
                poId,
                grnNo,
                grnDate,
                challanNo,
                challanDate,
                document,
                remark
            }, { transaction });

            if (grnItems && grnItems.length > 0) {
                const grnItemData = grnItems.map(item => ({
                    grnId: grn.id,
                    orderItemId: item.orderItemId,
                    receivedQuantity: item.receivedQuantity,
                    rejectedQuantity: item.rejectedQuantity || 0
                }));
                await GRNItem.bulkCreate(grnItemData, { transaction });

                // Fetch OrderItems to get correct itemId
                const orderItemIds = grnItems.map(item => item.orderItemId);
                const orderItems = await OrderItem.findAll({
                    where: { id: orderItemIds },
                    attributes: ['id', 'itemId'] // Only need id and itemId
                });

                const stockData = grnItems.map(item => {
                    const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                    return {
                        poId,
                        grnId: grn.id,
                        itemId: orderItem.itemId, // Use the correct itemId from OrderItem
                        quantity: item.receivedQuantity,
                        remark: item.remark
                    };
                });
                await StockStorage.bulkCreate(stockData, { transaction });
            }

            await transaction.commit();

            const createdGRN = await GRN.findByPk(grn.id, {
                include: [{ model: GRNItem, as: 'grnItems' }]
            });

            res.status(201).json(createdGRN);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error creating GRN:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

const updateGRN = async (req, res) => {
    try {
        const { poId, grnId } = req.params; // poId and grnId from URL
        const { grnNo, grnDate, challanNo, challanDate, document, remark, grnItems } = req.body;

        // Check if PurchaseOrder exists
        const purchaseOrder = await PurchaseOrder.findByPk(poId);
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Check if GRN exists
        const grn = await GRN.findOne({ where: { id: grnId, poId } });
        if (!grn) {
            return res.status(404).json({ message: 'GRN not found for this Purchase Order' });
        }

        // Validate orderItemId values if grnItems are provided
        if (grnItems && grnItems.length > 0) {
            for (const item of grnItems) {
                const orderItem = await OrderItem.findOne({
                    where: { id: item.orderItemId, poId }
                });
                if (!orderItem) {
                    return res.status(400).json({
                        message: `OrderItem with ID ${item.orderItemId} not found for Purchase Order ${poId}`
                    });
                }
            }
        }

        // Use a transaction for atomic updates
        const transaction = await sequelize.transaction();
        try {
            // Update GRN details
            await grn.update({
                grnNo,
                grnDate,
                challanNo,
                challanDate,
                document,
                remark
            }, { transaction });

            // If grnItems are provided, replace existing GRNItems
            if (grnItems && grnItems.length > 0) {
                // Delete existing GRNItems
                await GRNItem.destroy({ where: { grnId }, transaction });

                // Create new GRNItems
                const grnItemData = grnItems.map(item => ({
                    grnId: grn.id,
                    orderItemId: item.orderItemId,
                    receivedQuantity: item.receivedQuantity,
                    rejectedQuantity: item.rejectedQuantity || 0
                }));
                await GRNItem.bulkCreate(grnItemData, { transaction });
            }

            await transaction.commit();

            // Fetch the updated GRN with its items
            const updatedGRN = await GRN.findByPk(grn.id, {
                include: [{ model: GRNItem, as: 'grnItems' }]
            });

            res.status(200).json(updatedGRN);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error updating GRN:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};


// DELETE a GRN
const deleteGRN = async (req, res) => {
    try {
        const { poId, grnId } = req.params;

        // Check if PurchaseOrder exists
        const purchaseOrder = await PurchaseOrder.findByPk(poId);
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Check if GRN exists
        const grn = await GRN.findOne({ where: { id: grnId, poId } });
        if (!grn) {
            return res.status(404).json({ message: 'GRN not found for this Purchase Order' });
        }

        // Delete GRN (GRNItems will be deleted via cascade if configured, or manually)
        await grn.destroy();

        res.status(200).json({ message: 'GRN deleted successfully' });
    } catch (error) {
        console.error('Error deleting GRN:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// GET a GRN by ID
const getGRNById = async (req, res) => {
    try {
        const { poId, grnId } = req.params;

        // Check if PurchaseOrder exists
        const purchaseOrder = await PurchaseOrder.findByPk(poId);
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Fetch GRN with its GRNItems
        const grn = await GRN.findOne({
            where: { id: grnId, poId },
            include: [{ model: GRNItem, as: 'grnItems' }]
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

// GET all GRNs for a Purchase Order
const getAllGRNs = async (req, res) => {
    try {
        const { poId } = req.params;

        // Check if PurchaseOrder exists
        const purchaseOrder = await PurchaseOrder.findByPk(poId);
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Fetch all GRNs for this poId with their GRNItems
        const grns = await GRN.findAll({
            where: { poId },
            include: [{ model: GRNItem, as: 'grnItems' }]
        });

        res.status(200).json(grns);
    } catch (error) {
        console.error('Error fetching GRNs:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};


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
                const itemName = (await Item.findByPk(item.itemId))?.name || 'Unknown';
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
                include: [{ model: DistributionItem, as: 'item', include: [{ model: Item, as: 'item', attributes: ['name'] }] }]
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




module.exports = {
    createPurchaseOrder,
    getAllPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrder,
    deletePurchaseOrder,
    createGRN,
    updateGRN,
    deleteGRN,
    getGRNById,
    getAllGRNs,
    updateStockStorage,
    getStockStorageByItemId,
    createDistribution,
    getDistributionById
};