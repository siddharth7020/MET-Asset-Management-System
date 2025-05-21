
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const OrderItem = require('../../models/purchase/OrderItem');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');

// CREATE a new Purchase Order with Order Items
const createPurchaseOrder = async (req, res) => {
    try {
        const {
            poDate = new Date(), // Default to current date if not provided
            instituteId,
            financialYearId,
            vendorId,
            document,
            requestedBy,
            remark,
            orderItems // Array of { itemId, quantity, rate, discount }
        } = req.body;

        // Generate poNo in format PO-DDMMYY-01
        const date = new Date(poDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = String(date.getFullYear()).slice(-2); // Last two digits of year
        const dateString = `${day}${month}${year}`; // Format: DDMMYY

        // Find the last PO number for the same date to increment the sequence
        const lastPO = await PurchaseOrder.findOne({
            where: {
                poNo: {
                    [Op.like]: `PO-${dateString}-%`
                }
            },
            order: [['poNo', 'DESC']]
        });

        // Extract the sequence number and increment it
        let sequence = 1;
        if (lastPO && lastPO.poNo) {
            const parts = lastPO.poNo.split('-');
            if (parts.length === 3 && !isNaN(parts[2])) {
                const lastSequence = parseInt(parts[2], 10);
                sequence = lastSequence + 1;
            } else {
                console.warn(`Invalid poNo format found: ${lastPO.poNo}. Starting sequence at 1.`);
            }
        }
        const poNo = `PO-${dateString}-${String(sequence).padStart(2, '0')}`;

        // Create Purchase Order
        const purchaseOrder = await PurchaseOrder.create({
            poDate,
            poNo,
            instituteId,
            financialYearId,
            vendorId,
            document: JSON.stringify(document), // Convert to string
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
                totalAmount: (item.quantity * item.rate) - (item.discount || 0)
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
                { model: OrderItem, as: 'orderItems' }
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
            ]
        });
        console.log('Fetching Purchase Order:', purchaseOrder);

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
    const t = await sequelize.transaction(); // Start a transaction
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
            orderItems
        } = req.body;

        const purchaseOrder = await PurchaseOrder.findByPk(poId, {
            include: [{ model: OrderItem, as: 'orderItems' }],
            transaction: t,
        });
        if (!purchaseOrder) {
            await t.rollback();
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        await purchaseOrder.update(
            {
                poDate,
                poNo,
                instituteId,
                financialYearId,
                vendorId,
                document,
                requestedBy,
                remark,
            },
            { transaction: t }
        );

        if (orderItems && orderItems.length > 0) {
            const existingOrderItemIds = purchaseOrder.orderItems.map((item) => item.id);
            const newOrderItemIds = orderItems
                .filter((item) => item.id)
                .map((item) => item.id);

            const orderItemsToDelete = existingOrderItemIds.filter(
                (id) => !newOrderItemIds.includes(id)
            );
            if (orderItemsToDelete.length > 0) {
                await OrderItem.destroy({
                    where: { id: orderItemsToDelete },
                    transaction: t,
                });
            }

            for (const item of orderItems) {
                const orderItemData = {
                    poId: purchaseOrder.poId,
                    itemId: item.itemId,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.quantity * item.rate,
                    discount: item.discount || 0,
                    totalAmount: (item.quantity * item.rate) - (item.discount || 0),
                };

                if (item.id) {
                    await OrderItem.update(orderItemData, {
                        where: { id: item.id, poId: purchaseOrder.poId },
                        transaction: t,
                    });
                } else {
                    await OrderItem.create(orderItemData, { transaction: t });
                }
            }
        } else {
            await OrderItem.destroy({ where: { poId }, transaction: t });
        }

        const updatedOrder = await PurchaseOrder.findByPk(poId, {
            include: [{ model: OrderItem, as: 'orderItems' }],
            transaction: t,
        });

        await t.commit(); // Commit the transaction
        res.status(200).json(updatedOrder);
    } catch (error) {
        await t.rollback(); // Rollback on error
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

module.exports = {
    createPurchaseOrder,
    getAllPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrder,
    deletePurchaseOrder,
};