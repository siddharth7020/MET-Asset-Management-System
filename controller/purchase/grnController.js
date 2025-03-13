const GRN = require('../../model/purchase/grn');

// Create a new GRN
exports.createGrn = async (req, res) => {
    try {
        const {
            grnNO, grnDate, poNo, poDate, instituteName,
            financialYear, vendorName, challanNo, challanDate,
            document, requestedBy, remark, assetQuantity, assetData
        } = req.body;

        const newGrn = await GRN.create({
            grnNO,
            grnDate,
            poNo,
            poDate,
            instituteName,
            financialYear,
            vendorName,
            challanNo,
            challanDate,
            document,
            requestedBy,
            remark,
            assetQuantity,
            assetData
        });

        return res.status(201).json({
            success: true,
            data: newGrn,
            message: 'GRN created successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error creating GRN'
        });
    }
};

// Get all GRNs
exports.getAllGrns = async (req, res) => {
    try {
        const allGrns = await GRN.findAll();
        return res.status(200).json({
            success: true,
            data: allGrns,
            message: 'All GRNs retrieved successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error retrieving GRNs'
        });
    }
};

// Update a GRN by ID
exports.updateGrn = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedGrn = await GRN.findByPk(id);
        if (!updatedGrn) {
            return res.status(404).json({
                success: false,
                message: 'GRN not found'
            });
        }
        await updatedGrn.update(req.body);
        return res.status(200).json({
            success: true,
            data: updatedGrn,
            message: 'GRN updated successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error updating GRN'
        });
    }
};

// Delete a GRN by ID
exports.deleteGrn = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedGrn = await GRN.findByPk(id);
        if (!deletedGrn) {
            return res.status(404).json({
                success: false,
                message: 'GRN not found'
            });
        }
        await deletedGrn.destroy();
        return res.status(200).json({
            success: true,
            message: 'GRN deleted successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error deleting GRN'
        });
    }
};