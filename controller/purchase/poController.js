const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const OrderItem = require('../../models/purchase/OrderItem');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;

// CREATE a new Purchase Order with Order Items
const createPurchaseOrder = async (req, res) => {
    try {
        const {
            poDate = new Date(),
            instituteId,
            financialYearId,
            vendorId,
            requestedBy,
            remark,
            orderItems: orderItemsRaw
        } = req.body;

        // Parse orderItems if it's a JSON string
        let orderItems;
        try {
            orderItems = typeof orderItemsRaw === 'string' ? JSON.parse(orderItemsRaw) : orderItemsRaw;
        } catch (parseError) {
            return res.status(400).json({ message: 'Invalid orderItems format', error: parseError.message });
        }

        // Validate orderItems is an array
        if (!Array.isArray(orderItems)) {
            return res.status(400).json({ message: 'orderItems must be an array' });
        }

        // Validate orderItems content
        if (orderItems.length === 0) {
            return res.status(400).json({ message: 'At least one order item is required' });
        }
        for (const item of orderItems) {
            if (!item.itemId || !item.quantity || !item.rate) {
                return res.status(400).json({ message: 'Each order item must have itemId, quantity, and rate' });
            }
        }

        // Handle multiple file uploads
        let documentPaths = [];
        if (req.files && req.files.documents) {
            const documents = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
            const maxFileSize = 10 * 1024 * 1024; // 10MB

            for (const document of documents) {
                if (!allowedTypes.includes(document.mimetype)) {
                    return res.status(400).json({ message: `Invalid file type for ${document.name}. Only PDF, JPEG, and PNG are allowed.` });
                }
                if (document.size > maxFileSize) {
                    return res.status(400).json({ message: `File ${document.name} exceeds 10MB limit.` });
                }
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const fileExtension = path.extname(document.name);
                const fileName = `document-${uniqueSuffix}${fileExtension}`;
                const filePath = path.join('uploads', fileName);
                await fs.mkdir(path.join(__dirname, '../../Uploads'), { recursive: true });
                await document.mv(path.join(__dirname, '../../', filePath));
                documentPaths.push(filePath);
            }
        }

        // Generate poNo in format PO-DDMMYY-01
        const date = new Date(poDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const dateString = `${day}${month}${year}`;
        const lastPO = await PurchaseOrder.findOne({
            where: { poNo: { [Op.like]: `PO-${dateString}-%` } },
            order: [['poNo', 'DESC']]
        });

        let sequence = 1;
        if (lastPO && lastPO.poNo) {
            const parts = lastPO.poNo.split('-');
            if (parts.length === 3 && !isNaN(parts[2])) {
                sequence = parseInt(parts[2], 10) + 1;
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
            document: documentPaths.length > 0 ? documentPaths : null,
            requestedBy,
            remark
        });

        // Create associated Order Items
        if (orderItems && orderItems.length > 0) {
            const orderItemData = orderItems.map(item => ({
                poId: purchaseOrder.poId,
                itemId: item.itemId,
                unitId: item.unitId,
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

// UPDATE a Purchase Order
const updatePurchaseOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { poId } = req.params;
        const {
            poDate,
            poNo,
            instituteId,
            financialYearId,
            vendorId,
            requestedBy,
            remark,
            orderItems: orderItemsRaw,
            existingDocuments // Array of existing document paths to retain
        } = req.body;

        // Parse orderItems if it's a JSON string
        let orderItems;
        try {
            orderItems = typeof orderItemsRaw === 'string' ? JSON.parse(orderItemsRaw) : orderItemsRaw;
        } catch (parseError) {
            await t.rollback();
            return res.status(400).json({ message: 'Invalid orderItems format', error: parseError.message });
        }

        // Validate orderItems is an array
        if (!Array.isArray(orderItems)) {
            await t.rollback();
            return res.status(400).json({ message: 'orderItems must be an array' });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(poId, {
            include: [{ model: OrderItem, as: 'orderItems' }],
            transaction: t,
        });
        if (!purchaseOrder) {
            await t.rollback();
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Handle multiple file uploads
        let documentPaths = existingDocuments ? (Array.isArray(existingDocuments) ? existingDocuments : JSON.parse(existingDocuments)) : [];
        if (req.files && req.files.documents) {
            const documents = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
            const maxFileSize = 10 * 1024 * 1024; // 10MB

            for (const document of documents) {
                if (!allowedTypes.includes(document.mimetype)) {
                    await t.rollback();
                    return res.status(400).json({ message: `Invalid file type for ${document.name}. Only PDF, JPEG, and PNG are allowed.` });
                }
                if (document.size > maxFileSize) {
                    await t.rollback();
                    return res.status(400).json({ message: `File ${document.name} exceeds 10MB limit.` });
                }
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const fileExtension = path.extname(document.name);
                const fileName = `document-${uniqueSuffix}${fileExtension}`;
                const filePath = path.join('Uploads', fileName);
                await fs.mkdir(path.join(__dirname, '../../Uploads'), { recursive: true });
                await document.mv(path.join(__dirname, '../../', filePath));
                documentPaths.push(filePath);
            }
        }

        // Delete old files that are no longer referenced
        const oldDocuments = purchaseOrder.document || [];
        const documentsToDelete = oldDocuments.filter(doc => !documentPaths.includes(doc));
        for (const doc of documentsToDelete) {
            try {
                await fs.unlink(path.join(__dirname, '../../', doc));
            } catch (err) {
                console.warn(`Failed to delete old file: ${doc}`, err);
            }
        }

        await purchaseOrder.update(
            {
                poDate,
                poNo,
                instituteId,
                financialYearId,
                vendorId,
                document: documentPaths.length > 0 ? documentPaths : null,
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
                    unitId: item.unitId,
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

        await t.commit();
        res.status(200).json(updatedOrder);
    } catch (error) {
        await t.rollback();
        console.error('Error updating Purchase Order:', error);
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

        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        res.status(200).json(purchaseOrder);
    } catch (error) {
        console.error('Error fetching Purchase Order:', error);
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

        if (purchaseOrder.document && Array.isArray(purchaseOrder.document)) {
            for (const doc of purchaseOrder.document) {
                try {
                    await fs.unlink(path.join(__dirname, '../../', doc));
                } catch (err) {
                    console.warn(`Failed to delete file: ${doc}`, err);
                }
            }
        }

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