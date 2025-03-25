const OrderItem = require("../../models/purchase/OrderItem");

// 📌 Get Order Items by Purchase Order ID
exports.getOrderItemsByPO = async (req, res) => {
    try {
        const orderItems = await OrderItem.findAll({ where: { poId: req.params.poId } });
        res.json(orderItems);
    } catch (error) {
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
};
