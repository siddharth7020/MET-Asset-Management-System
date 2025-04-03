const Invoice = require('../../models/purchase/invoice');
const GRN = require('../../models/purchase/GRN');
const GRNItem = require('../../models/purchase/GRNItem'); // Assuming this exists
const OrderItem = require('../../models/purchase/OrderItem'); // Assuming this exists
const { Op } = require('sequelize');

const invoiceController = {
    // Create Invoice
    createInvoice: async (req, res) => {
        try {
            const { invoiceNo, grnNos, invoiceDate, paidAmount = 0, paymentDetails, paymentDate } = req.body;

            // Validate GRNs exist
            const grns = await GRN.findAll({
                where: {
                    grnNo: { [Op.in]: grnNos }
                },
                include: [{
                    model: GRNItem,
                    as: 'grnItems',
                    attributes: ['id', 'grnId', 'orderItemId', 'receivedQuantity', 'rejectedQuantity'],
                    include: [{
                        model: OrderItem,
                        as: 'orderItem'
                    }]
                }]
            });

            if (grns.length !== grnNos.length) {
                return res.status(400).json({ message: 'One or more GRNs not found' });
            }

            // Calculate invoice amount
            let invoiceAmount = 0;
            grns.forEach(grn => {
                grn.grnItems.forEach(grnItem => {
                    invoiceAmount += grnItem.orderItem.totalAmount || (grnItem.orderItem.quantity * grnItem.orderItem.rate);
                });
            });

            // Create invoice
            const invoice = await Invoice.create({
                invoiceNo,
                grnNos,
                invoiceDate,
                invoiceAmount,
                paidAmount,
                paymentDetails,
                paymentDate
            });

            // Associate GRNs with invoice
            await invoice.setGRNs(grns);

            const createdInvoice = await Invoice.findByPk(invoice.id, {
                include: [GRN]
            });

            res.status(201).json(createdInvoice);
        } catch (error) {
            console.error('Error creating invoice:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    },

    // Get All Invoices
    getAllInvoices: async (req, res) => {
        try {
            const invoices = await Invoice.findAll({
                include: [{
                    model: GRN,
                    through: { attributes: [] } // Hide junction table attributes
                }]
            });
            res.status(200).json(invoices);
        } catch (error) {
            console.error('Error fetching invoices:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    },

    // Get Invoice by ID
    getInvoiceById: async (req, res) => {
        try {
            const invoice = await Invoice.findByPk(req.params.id, {
                include: [{
                    model: GRN,
                    include: [{
                        model: GRNItem,
                        as: 'grnItems',
                        include: [{ model: OrderItem, as: 'orderItem' }]
                    }]
                }]
            });

            if (!invoice) {
                return res.status(404).json({ message: 'Invoice not found' });
            }
            res.status(200).json(invoice);
        } catch (error) {
            console.error('Error fetching invoice:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    },

    // Update Invoice
    updateInvoice: async (req, res) => {
        try {
            const { invoiceNo, grnNos, invoiceDate, paidAmount, paymentDetails, paymentDate } = req.body;
            const invoice = await Invoice.findByPk(req.params.id);

            if (!invoice) {
                return res.status(404).json({ message: 'Invoice not found' });
            }

            // If GRNs are updated, recalculate invoice amount
            let invoiceAmount = invoice.invoiceAmount;
            if (grnNos && grnNos.length > 0) {
                const grns = await GRN.findAll({
                    where: { grnNo: { [Op.in]: grnNos } },
                    include: [{
                        model: GRNItem,
                        as: 'grnItems',
                        include: [{ model: OrderItem, as: 'orderItem' }]
                    }]
                });

                if (grns.length !== grnNos.length) {
                    return res.status(400).json({ message: 'One or more GRNs not found' });
                }

                invoiceAmount = 0;
                grns.forEach(grn => {
                    grn.grnItems.forEach(grnItem => {
                        invoiceAmount += grnItem.orderItem.totalAmount || (grnItem.orderItem.quantity * grnItem.orderItem.rate);
                    });
                });

                await invoice.setGRNs(grns);
            }

            // Update invoice
            await invoice.update({
                invoiceNo: invoiceNo || invoice.invoiceNo,
                grnNos: grnNos || invoice.grnNos,
                invoiceDate: invoiceDate || invoice.invoiceDate,
                invoiceAmount,
                paidAmount: paidAmount !== undefined ? paidAmount : invoice.paidAmount,
                paymentDetails: paymentDetails !== undefined ? paymentDetails : invoice.paymentDetails,
                paymentDate: paymentDate !== undefined ? paymentDate : invoice.paymentDate
            });

            const updatedInvoice = await Invoice.findByPk(req.params.id, {
                include: [GRN]
            });
            res.status(200).json(updatedInvoice);
        } catch (error) {
            console.error('Error updating invoice:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    },

    // Delete Invoice
    deleteInvoice: async (req, res) => {
        try {
            const invoice = await Invoice.findByPk(req.params.id);
            if (!invoice) {
                return res.status(404).json({ message: 'Invoice not found' });
            }

            await invoice.destroy();
            res.status(200).json({ message: 'Invoice deleted successfully' });
        } catch (error) {
            console.error('Error deleting invoice:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
};

module.exports = invoiceController;