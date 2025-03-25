const GRN = require('../../models/purchase/GRN');
const GRNItem = require('../../models/purchase/GRNItem');

// 📌 Create GRN
exports.createGRN = async (req, res) => {
    try {
        const { poId, grnNo, grnDate, challanNo, challanDate, document, remark, grnItems } = req.body;

        if (!poId || !grnNo || !grnDate || !challanNo || !challanDate) {
            return res.status(400).json({ message: "Missing required fields!" });
        }

        const grn = await GRN.create({ poId, grnNo, grnDate, challanNo, challanDate, document, remark });

        if (grnItems && grnItems.length > 0) {
            const items = grnItems.map(item => ({ ...item, grnId: grn.id }));
            await GRNItem.bulkCreate(items);
        }

        res.status(201).json({ message: "GRN created successfully!", grn });
    } catch (error) {
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
};

// 📌 Get all GRNs
exports.getAllGRNs = async (req, res) => {
    try {
        const grns = await GRN.findAll({ include: [{ model: GRNItem, as: 'grnItems' }] });
        res.json(grns);
    } catch (error) {
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
};
