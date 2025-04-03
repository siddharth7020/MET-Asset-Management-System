
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const OrderItem = require('../../models/purchase/OrderItem');

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

module.exports = {
    createPurchaseOrder,
    getAllPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrder,
    deletePurchaseOrder,
};