const GRNItem = require('../../models/purchase/GRNItem');

// 📌 Get GRN Items by GRN ID
exports.getGRNItemsByGRN = async (req, res) => {
    try {
        const grnItems = await GRNItem.findAll({ where: { grnId: req.params.grnId } });
        res.json(grnItems);
    } catch (error) {
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
};
