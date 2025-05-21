const GRN = require('../../models/purchase/GRN');
const GRNItem = require('../../models/purchase/GRNItem');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const OrderItem = require('../../models/purchase/OrderItem');
const StockStorage = require('../../models/distribution/stockStorage');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');


// GET all GRNs for a Purchase Order
const getAllGRNs = async (req, res) => {
    try {
        // Fetch all GRNs with their GRNItems
        const grns = await GRN.findAll({
            include: [{ model: GRNItem, as: 'grnItems' }]
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
        const {  id } = req.params;
        // Fetch GRN with its GRNItems
        const grn = await GRN.findOne({
            where: { id: id },
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

// Create GRN with Items and Stock Storage
const createGRN = async (req, res) => {
    try {
        const { poId } = req.params;
        const { grnDate = new Date(), challanNo, challanDate, document, remark, grnItems } = req.body;

        // Validate required fields
        if (!grnDate || !challanNo || !challanDate) {
            return res.status(400).json({ message: 'grnDate, challanNo, and challanDate are required' });
        }

        // Check if Purchase Order exists
        const purchaseOrder = await PurchaseOrder.findByPk(poId);
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Generate grnNo in format GRN-DDMMYY-01
        const date = new Date(grnDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = String(date.getFullYear()).slice(-2); // Last two digits of year

        // Find the last GRN number for the same date to increment the sequence
        const lastGRN = await GRN.findOne({
            where: {
                grnNo: {
                    [Op.like]: `GRN-${day}${month}${year}-%`
                }
            },
            order: [['grnNo', 'DESC']]
        });

        // Extract the sequence number and increment it
        let sequence = 1;
        if (lastGRN) {
            const lastSequence = parseInt(lastGRN.grnNo.split('-')[2], 10);
            sequence = lastSequence + 1;
        }
        const grnNo = `GRN-${day}${month}${year}-${String(sequence).padStart(2, '0')}`;

        // Validate OrderItem IDs
        const orderItemIds = grnItems.map(item => item.orderItemId);
        const orderItems = await OrderItem.findAll({ where: { id: orderItemIds, poId } });

        if (orderItems.length !== orderItemIds.length) {
            const invalidIds = orderItemIds.filter(id => !orderItems.some(item => item.id === id));
            return res.status(400).json({ message: `OrderItem IDs not found for PO ${poId}: ${invalidIds.join(', ')}` });
        }

        // Check if any order item has remaining quantity to receive
        const itemsWithRemainingQuantity = await Promise.all(orderItems.map(async (orderItem) => {
            const previousReceived = await GRNItem.sum('receivedQuantity', {
                where: { orderItemId: orderItem.id }
            });
            const remainingQuantity = orderItem.quantity - (previousReceived || 0);
            return { orderItemId: orderItem.id, remainingQuantity };
        }));

        const validGrnItems = grnItems.filter(item => {
            const itemInfo = itemsWithRemainingQuantity.find(i => i.orderItemId === item.orderItemId);
            return itemInfo && itemInfo.remainingQuantity > 0 && item.receivedQuantity > 0;
        });

        if (validGrnItems.length === 0) {
            return res.status(400).json({
                message: 'No valid items to receive. All items are either fully received or have invalid received quantities.'
            });
        }

        const transaction = await sequelize.transaction();
        try {
            // Create GRN
            const grn = await GRN.create({
                poId,
                grnNo,
                grnDate,
                challanNo,
                challanDate,
                document,
                remark
            }, { transaction });

            // Create GRN Items
            const grnItemData = await Promise.all(validGrnItems.map(async (item) => {
                const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                const previousReceived = await GRNItem.sum('receivedQuantity', {
                    where: { orderItemId: item.orderItemId },
                    transaction
                });
                const remainingQuantity = orderItem.quantity - (previousReceived || 0);

                // Cap received quantity to remaining quantity
                const receivedQuantity = Math.min(item.receivedQuantity, remainingQuantity);
                const rejectedQuantity = item.receivedQuantity > remainingQuantity ? item.receivedQuantity - remainingQuantity : 0;

                return {
                    grnId: grn.id,
                    orderItemId: item.orderItemId,
                    receivedQuantity,
                    rejectedQuantity
                };
            }));

            await GRNItem.bulkCreate(grnItemData, { transaction });

            // Stock Update in StockStorage
            for (const item of grnItemData) {
                const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                const stockRecord = await StockStorage.findOne({
                    where: {
                        poId,
                        grnId: grn.id,
                        itemId: orderItem.itemId
                    },
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
                        poId,
                        grnId: grn.id,
                        qGRNId: null,
                        itemId: orderItem.itemId,
                        quantity: item.receivedQuantity,
                        remark: remark || null
                    }, { transaction });
                }
            }

            await transaction.commit();

            // Fetch the created GRN with its items
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
        const { grnId } = req.params;
        const {
            grnNo,
            grnDate,
            challanNo,
            challanDate,
            document,
            remark,
            grnItems // Array of { id (optional for new items), orderItemId, receivedQuantity, rejectedQuantity (optional) }
        } = req.body;

        // Find the GRN
        const grn = await GRN.findByPk(grnId, {
            include: [{ model: GRNItem, as: 'grnItems' }],
        });
        if (!grn) {
            return res.status(404).json({ message: 'GRN not found' });
        }

        // Start a transaction
        const transaction = await sequelize.transaction();
        try {
            // Update GRN main data (only update provided fields)
            await grn.update(
                {
                    grnNo: grnNo ?? grn.grnNo,
                    grnDate: grnDate ?? grn.grnDate,
                    challanNo: challanNo ?? grn.challanNo,
                    challanDate: challanDate ?? grn.challanDate,
                    document: document !== undefined ? document : grn.document,
                    remark: remark !== undefined ? remark : grn.remark,
                },
                { transaction }
            );

            // Handle GRN Items
            if (grnItems && grnItems.length > 0) {
                // Get existing GRNItem IDs
                const existingGRNItemIds = grn.grnItems.map((item) => item.id);
                const providedGRNItemIds = grnItems
                    .filter((item) => item.id)
                    .map((item) => item.id);

                // Delete GRNItems that are not in the updated list
                const grnItemsToDelete = existingGRNItemIds.filter(
                    (id) => !providedGRNItemIds.includes(id)
                );
                if (grnItemsToDelete.length > 0) {
                    // Adjust StockStorage for deleted GRNItems
                    const deletedGRNItems = grn.grnItems.filter((item) =>
                        grnItemsToDelete.includes(item.id)
                    );
                    for (const item of deletedGRNItems) {
                        const orderItem = await OrderItem.findByPk(item.orderItemId, { transaction });
                        if (orderItem) {
                            const stock = await StockStorage.findOne({
                                where: { grnId: grn.id, itemId: orderItem.itemId },
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
                    // Delete the GRNItems
                    await GRNItem.destroy({
                        where: { id: grnItemsToDelete },
                        transaction,
                    });
                }

                // Process each GRNItem
                for (const item of grnItems) {
                    // Validate orderItemId
                    const orderItem = await OrderItem.findByPk(item.orderItemId, { transaction });
                    if (!orderItem || orderItem.poId !== grn.poId) {
                        await transaction.rollback();
                        return res.status(400).json({
                            message: `Invalid orderItemId: ${item.orderItemId} does not belong to poId: ${grn.poId}`,
                        });
                    }

                    // Calculate remaining quantity
                    const prevReceived = await GRNItem.sum('receivedQuantity', {
                        where: { orderItemId: item.orderItemId, id: { [Op.ne]: item.id || 0 } }, // Fixed: Use Op.ne
                        transaction,
                    });
                    const remainingQuantity = orderItem.quantity - (prevReceived || 0);
                    if (item.receivedQuantity > remainingQuantity) {
                        await transaction.rollback();
                        return res.status(400).json({
                            message: `Received quantity (${item.receivedQuantity}) exceeds remaining quantity (${remainingQuantity}) for orderItemId: ${item.orderItemId}`,
                        });
                    }

                    const rejectedQuantity =
                        item.rejectedQuantity !== undefined
                            ? item.rejectedQuantity
                            : Math.max(remainingQuantity - item.receivedQuantity, 0);

                    const grnItemData = {
                        grnId: grn.id,
                        orderItemId: item.orderItemId,
                        receivedQuantity: item.receivedQuantity,
                        rejectedQuantity,
                    };

                    if (item.id) {
                        // Update existing GRNItem
                        const existingGRNItem = grn.grnItems.find((gi) => gi.id === item.id);
                        if (!existingGRNItem) {
                            await transaction.rollback();
                            return res.status(400).json({
                                message: `GRNItem with id: ${item.id} not found for grnId: ${grnId}`,
                            });
                        }

                        // Adjust StockStorage for the change in receivedQuantity
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

                        // Update GRNItem
                        await GRNItem.update(grnItemData, {
                            where: { id: item.id, grnId: grn.id },
                            transaction,
                        });
                    } else {
                        // Create new GRNItem
                        const newGRNItem = await GRNItem.create(grnItemData, { transaction });

                        // Update StockStorage for new GRNItem
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
                // If no grnItems provided, delete all existing GRNItems and adjust StockStorage
                for (const item of grn.grnItems) {
                    const orderItem = await OrderItem.findByPk(item.orderItemId, { transaction });
                    if (orderItem) {
                        const stock = await StockStorage.findOne({
                            where: { grnId: grn.id, itemId: orderItem.itemId },
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

            // Fetch the updated GRN with its items
            const updatedGRN = await GRN.findByPk(grnId, {
                include: [{ model: GRNItem, as: 'grnItems' }],
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
        const { grnId } = req.params;

        const grn = await GRN.findByPk(grnId);
        if (!grn) {
            return res.status(404).json({ message: 'GRN not found' });
        }

        const transaction = await sequelize.transaction();
        try {
            const grnItems = await GRNItem.findAll({ where: { grnId }, transaction });

            // Update stock quantities before deleting
            for (const item of grnItems) {
                const orderItem = await OrderItem.findByPk(item.orderItemId, { transaction });

                if (orderItem) {
                    const stock = await StockStorage.findOne({
                        where: {
                            grnId: grn.id,
                            itemId: orderItem.itemId
                        },
                        transaction
                    });

                    if (stock) {
                        // Subtract the received quantity from stock
                        stock.quantity -= item.receivedQuantity;

                        // If quantity is 0 or less, delete the stock record
                        if (stock.quantity <= 0) {
                            await stock.destroy({ transaction });
                        } else {
                            await stock.save({ transaction });
                        }
                    }
                }
            }

            // Delete GRNItems
            await GRNItem.destroy({ where: { grnId }, transaction });

            // Delete GRN
            await grn.destroy({ transaction });

            await transaction.commit();
            res.status(200).json({ message: 'GRN and associated stock deleted successfully' });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error deleting GRN:', error);
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

// 📌 Create GRN
// exports.createGRN = async (req, res) => {
//     try {
//         const { poId, grnNo, grnDate, challanNo, challanDate, document, remark, grnItems } = req.body;

//         if (!poId || !grnNo || !grnDate || !challanNo || !challanDate) {
//             return res.status(400).json({ message: "Missing required fields!" });
//         }

//         const grn = await GRN.create({ poId, grnNo, grnDate, challanNo, challanDate, document, remark });

//         if (grnItems && grnItems.length > 0) {
//             const items = grnItems.map(item => ({ ...item, grnId: grn.id }));
//             await GRNItem.bulkCreate(items);
//         }

//         res.status(201).json({ message: "GRN created successfully!", grn });
//     } catch (error) {
//         res.status(500).json({ message: "Server Error!", error: error.message });
//     }
// };

// 📌 Get all GRNs
// exports.getAllGRNs = async (req, res) => {
//     try {
//         const grns = await GRN.findAll({ include: [{ model: GRNItem, as: 'grnItems' }] });
//         res.json(grns);
//     } catch (error) {
//         res.status(500).json({ message: "Server Error!", error: error.message });
//     }
// };
