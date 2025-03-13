const Invoice = require('../../model/purchase/invoice');
const Grn = require('../../model/purchase/grn'); // Adjust path to your Grn model

// Get all invoices with full GRN details
exports.getAllInvoices = (req, res, next) => {
    Invoice.findAll()
        .then(async invoices => {
            const invoicesWithGrns = await Promise.all(
                invoices.map(async (invoice) => {
                    const invoiceData = invoice.toJSON();
                    if (invoiceData.grnNOs && invoiceData.grnNOs.length > 0) {
                        const grns = await Grn.findAll({
                            where: {
                                grnNO: invoiceData.grnNOs
                            }
                            // No attributes specified, so all fields are included
                        });
                        invoiceData.grns = grns.map(grn => grn.toJSON());
                    } else {
                        invoiceData.grns = [];
                    }
                    return invoiceData;
                })
            );

            res.status(200).json({
                success: true,
                message: 'All invoices fetched successfully',
                data: invoicesWithGrns
            });
        })
        .catch(err => {
            res.status(500).json({
                success: false,
                message: 'Something went wrong',
                error: err.message
            });
        });
};

// Create a new invoice
exports.createInvoice = (req, res, next) => {
    const { invoiceNO, grnNOs } = req.body;

    if (!invoiceNO) {
        return res.status(400).json({
            success: false,
            message: 'Invoice number (invoiceNO) is required'
        });
    }

    const validatedGrnNOs = Array.isArray(grnNOs) ? grnNOs : [];

    Invoice.create({
        invoiceNO,
        grnNOs: validatedGrnNOs
    })
        .then(async invoice => {
            const invoiceData = invoice.toJSON();

            if (invoiceData.grnNOs && invoiceData.grnNOs.length > 0) {
                const grns = await Grn.findAll({
                    where: {
                        grnNO: invoiceData.grnNOs
                    }
                    // No attributes specified, so all fields are included
                });
                invoiceData.grns = grns.map(grn => grn.toJSON());
            } else {
                invoiceData.grns = [];
            }

            res.status(201).json({
                success: true,
                message: 'Invoice created successfully',
                data: invoiceData
            });
        })
        .catch(err => {
            res.status(500).json({
                success: false,
                message: 'Something went wrong',
                error: err.message
            });
        });
};

// Update an existing invoice
exports.updateInvoice = (req, res, next) => {
    const { invoiceNO, grnNOs } = req.body;

    Invoice.findByPk(req.params.id)
        .then(invoice => {
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Invoice not found'
                });
            }

            const updateData = {};
            if (invoiceNO !== undefined) updateData.invoiceNO = invoiceNO;
            if (grnNOs !== undefined) {
                updateData.grnNOs = Array.isArray(grnNOs) ? grnNOs : [];
            }

            return Invoice.update(updateData, {
                where: { id: req.params.id },
                returning: true // PostgreSQL only
            });
        })
        .then(async ([rowsUpdated, [updatedInvoice]]) => {
            if (rowsUpdated === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Invoice not found or no changes made'
                });
            }

            const invoiceData = updatedInvoice.toJSON();
            if (invoiceData.grnNOs && invoiceData.grnNOs.length > 0) {
                const grns = await Grn.findAll({
                    where: {
                        grnNO: invoiceData.grnNOs
                    }
                    // No attributes specified, so all fields are included
                });
                invoiceData.grns = grns.map(grn => grn.toJSON());
            } else {
                invoiceData.grns = [];
            }

            res.status(200).json({
                success: true,
                message: 'Invoice updated successfully',
                data: invoiceData
            });
        })
        .catch(err => {
            res.status(500).json({
                success: false,
                message: 'Something went wrong',
                error: err.message
            });
        });
};

// Delete an invoice
exports.deleteInvoice = (req, res, next) => {
    Invoice.destroy({
        where: { id: req.params.id }
    })
        .then(rowsDeleted => {
            if (rowsDeleted === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Invoice not found'
                });
            }
            res.status(200).json({
                success: true,
                message: 'Invoice deleted successfully'
            });
        })
        .catch(err => {
            res.status(500).json({
                success: false,
                message: 'Something went wrong',
                error: err.message
            });
        });
};