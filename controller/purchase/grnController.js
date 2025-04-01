const GRN = require('../../models/purchase/GRN');
const GRNItem = require('../../models/purchase/GRNItem');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const OrderItem = require('../../models/purchase/OrderItem');
const StockStorage = require('../../models/distribution/stockStorage');
const sequelize = require('../../config/database');



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
                    message: `OrderItem IDs not found for Purchase Order ${poId}: ${invalidIds.join(', ')}`,
                });
            }

            for (const item of grnItems) {
                const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                
                if (item.receivedQuantity > orderItem.quantity) {
                    return res.status(400).json({
                        message: `Received quantity (${item.receivedQuantity}) exceeds ordered quantity (${orderItem.quantity}) for OrderItem ${item.orderItemId}`,
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
                remark,
            }, { transaction });

            if (grnItems && grnItems.length > 0) {
                const orderItemIds = grnItems.map(item => item.orderItemId);
                const orderItems = await OrderItem.findAll({
                    where: { id: orderItemIds },
                    attributes: ['id', 'itemId', 'quantity'], // Fetch `quantity` to calculate rejectedQuantity
                });

                const grnItemData = grnItems.map(item => {
                    const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                    const rejectedQuantity = Math.max(orderItem.quantity - item.receivedQuantity, 0); // Ensure non-negative

                    return {
                        grnId: grn.id,
                        orderItemId: item.orderItemId,
                        receivedQuantity: item.receivedQuantity,
                        rejectedQuantity, // Auto-calculated
                    };
                });

                await GRNItem.bulkCreate(grnItemData, { transaction });

                const stockData = grnItemData.map(item => {
                    const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                    return {
                        poId,
                        grnId: grn.id,
                        itemId: orderItem.itemId,
                        quantity: item.receivedQuantity,
                        remark: item.remark || null,
                    };
                });

                await StockStorage.bulkCreate(stockData, { transaction });
            }

            await transaction.commit();

            const createdGRN = await GRN.findByPk(grn.id, {
                include: [{ model: GRNItem, as: 'grnItems' }],
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
        const { grnNo, grnDate, challanNo, challanDate, document, remark, grnItems } = req.body;

        const grn = await GRN.findByPk(grnId);
        if (!grn) {
            return res.status(404).json({ message: 'GRN not found' });
        }

        const transaction = await sequelize.transaction();
        try {
            // Update GRN details
            await grn.update({ grnNo, grnDate, challanNo, challanDate, document, remark }, { transaction });

            if (grnItems && grnItems.length > 0) {
                const orderItemIds = grnItems.map(item => item.orderItemId);
                
                const orderItems = await OrderItem.findAll({
                    where: { id: orderItemIds },
                    attributes: ['id', 'itemId', 'quantity']
                });

                // Validate receivedQuantity does not exceed ordered quantity
                for (const item of grnItems) {
                    const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                    if (!orderItem) {
                        return res.status(400).json({ message: `OrderItem ${item.orderItemId} not found` });
                    }

                    if (item.receivedQuantity > orderItem.quantity) {
                        return res.status(400).json({
                            message: `Received quantity (${item.receivedQuantity}) exceeds ordered quantity (${orderItem.quantity}) for OrderItem ${item.orderItemId}`
                        });
                    }
                }

                // Delete existing GRN items before adding new ones
                await GRNItem.destroy({ where: { grnId }, transaction });

                // Insert updated GRN items
                const grnItemData = grnItems.map(item => {
                    const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                    const rejectedQuantity = Math.max(orderItem.quantity - item.receivedQuantity, 0);

                    return {
                        grnId: grn.id,
                        orderItemId: item.orderItemId,
                        receivedQuantity: item.receivedQuantity,
                        rejectedQuantity
                    };
                });

                await GRNItem.bulkCreate(grnItemData, { transaction });

                // Update Stock Storage
                await StockStorage.destroy({ where: { grnId }, transaction });

                const stockData = grnItemData.map(item => {
                    const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                    return {
                        poId: grn.poId,
                        grnId: grn.id,
                        itemId: orderItem.itemId,
                        quantity: item.receivedQuantity,
                        remark: remark || null
                    };
                });

                await StockStorage.bulkCreate(stockData, { transaction });
            }

            await transaction.commit();

            const updatedGRN = await GRN.findByPk(grn.id, {
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
