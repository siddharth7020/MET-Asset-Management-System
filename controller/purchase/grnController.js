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

        const orderItemIds = grnItems.map(item => item.orderItemId);
        const orderItems = await OrderItem.findAll({ where: { id: orderItemIds, poId } });

        if (orderItems.length !== orderItemIds.length) {
            const invalidIds = orderItemIds.filter(id => !orderItems.some(item => item.id === id));
            return res.status(400).json({ message: `OrderItem IDs not found for PO ${poId}: ${invalidIds.join(', ')}` });
        }

        const transaction = await sequelize.transaction();
        try {
            const grn = await GRN.create({ poId, grnNo, grnDate, challanNo, challanDate, document, remark }, { transaction });

            const grnItemData = await Promise.all(grnItems.map(async (item) => {
                const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                const previousReceived = await GRNItem.sum('receivedQuantity', { where: { orderItemId: item.orderItemId } });
                const remainingQuantity = orderItem.quantity - (previousReceived || 0);
                const rejectedQuantity = Math.max(remainingQuantity - item.receivedQuantity, 0);

                return {
                    grnId: grn.id,
                    orderItemId: item.orderItemId,
                    receivedQuantity: item.receivedQuantity,
                    rejectedQuantity
                };
            }));

            await GRNItem.bulkCreate(grnItemData, { transaction });

            // Stock Update (Ensure StockStorage ID remains unchanged)
            for (const item of grnItemData) {
                const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                const stockRecord = await StockStorage.findOne({
                    where: { poId, grnId: grn.id, itemId: orderItem.itemId }
                });

                if (stockRecord) {
                    await stockRecord.update({ quantity: stockRecord.quantity + item.receivedQuantity }, { transaction });
                } else {
                    await StockStorage.create({
                        poId,
                        grnId: grn.id,
                        itemId: orderItem.itemId,
                        quantity: item.receivedQuantity,
                        remark: remark || null
                    }, { transaction });
                }
            }

            await transaction.commit();
            const createdGRN = await GRN.findByPk(grn.id, { include: [{ model: GRNItem, as: 'grnItems' }] });
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
            await grn.update({ grnNo, grnDate, challanNo, challanDate, document, remark }, { transaction });

            if (grnItems && grnItems.length > 0) {
                const orderItemIds = grnItems.map(item => item.orderItemId);
                const orderItems = await OrderItem.findAll({ where: { id: orderItemIds } });

                for (const item of grnItems) {
                    const orderItem = orderItems.find(oi => oi.id === item.orderItemId);
                    if (!orderItem) {
                        return res.status(400).json({ message: `OrderItem ${item.orderItemId} not found` });
                    }

                    const previousReceived = await GRNItem.sum('receivedQuantity', {
                        where: { orderItemId: item.orderItemId }
                    });

                    const remainingQuantity = orderItem.quantity - (previousReceived || 0);
                    const rejectedQuantity = Math.max(remainingQuantity - item.receivedQuantity, 0);

                    await GRNItem.update(
                        { receivedQuantity: item.receivedQuantity, rejectedQuantity },
                        { where: { grnId, orderItemId: item.orderItemId }, transaction }
                    );

                    // Stock Update (Maintain ID)
                    const stockRecord = await StockStorage.findOne({
                        where: { grnId, itemId: orderItem.itemId }
                    });

                    if (stockRecord) {
                        await stockRecord.update({ quantity: item.receivedQuantity }, { transaction });
                    }
                }
            }

            await transaction.commit();
            const updatedGRN = await GRN.findByPk(grn.id, { include: [{ model: GRNItem, as: 'grnItems' }] });
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
