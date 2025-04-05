const QuickGRN = require('../../models/purchase/quickGRN');
const QuickGRNItem = require('../../models/purchase/quickGRNItem');

// Create QuickGRN with Items
const createQuickGRN = async (req, res) => {
    try {
        const {
            qGRNDate,
            qGRNNo,
            instituteId,
            financialYearId,
            vendorId,
            challanNo,
            challanDate,
            document,
            requestedBy,
            remark,
            quickGRNItems // Array of { itemId, quantity, rate, discount, receivedQuantity, rejectedQuantity }
        } = req.body;

        // Create QuickGRN
        const quickGRN = await QuickGRN.create({
            qGRNDate,
            qGRNNo,
            instituteId,
            financialYearId,
            vendorId,
            challanNo,
            challanDate,
            document,
            requestedBy,
            remark
        });

        // Create associated QuickGRN Items
        if (quickGRNItems && quickGRNItems.length > 0) {
            const quickGRNItemData = quickGRNItems.map(item => ({
                qGRNId: quickGRN.qGRNId, // Fixed from poId to qGRNId
                itemId: item.itemId,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.quantity * item.rate,
                discount: item.discount || 0,
                totalAmount: (item.quantity * item.rate) - (item.discount || 0),
                receivedQuantity: item.receivedQuantity || 0,
                rejectedQuantity: item.rejectedQuantity || (item.quantity - (item.receivedQuantity || 0))
            }));
            await QuickGRNItem.bulkCreate(quickGRNItemData);
        }

        // Fetch the created QuickGRN with its items
        const createdOrder = await QuickGRN.findByPk(quickGRN.qGRNId, {
            include: [{ model: QuickGRNItem, as: 'items' }] // Fixed alias from 'quickGRNItems' to 'items'
        });

        res.status(201).json(createdOrder);
    } catch (error) {
        console.error('Error creating QuickGRN:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = {
    createQuickGRN
};