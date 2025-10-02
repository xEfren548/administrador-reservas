const Costo = require('../models/Costos');
const NotFoundError = require("../common/error/not-found-error");
const BadRequestError = require("../common/error/bad-request-error");
const { check } = require("express-validator");

const createCostValidators = [
    check("costName")
        .notEmpty().withMessage('Cost name is required')
        .custom(async (value, { req }) => {
            const cost = await Costo.findOne({ costName: value });
            if (cost) {
                throw new NotFoundError('Cost already exists');
            }
            return true;
        }),
    check('category')
        .notEmpty().withMessage('Category is required')
        .isIn(['Dueño', 'Gerente', 'Vendedor', 'vendedor virtual']).withMessage('Invalid category'),
    check('commission')
        .notEmpty().withMessage('Commission is required')
        .isIn(['Aumento porcentual', 'Aumento por costo fijo']).withMessage('Invalid commission'),
    check()
        .custom(async (value, { req }) => {
            const {amount, minAmount, maxAmount } = req.body;
            console.log("amount: ", amount);
            console.log("minAmount: ", minAmount);
            console.log("maxAmount: ", maxAmount);
            if(amount && (minAmount || maxAmount)){
                throw new BadRequestError("Incoherent amounts")
            }
            if(!amount && !(minAmount && maxAmount)){
                throw new BadRequestError("Both min and max amounts must be provided")
            }
            if(parseFloat(minAmount) >= parseFloat(maxAmount)){
                throw new BadRequestError("Min amount must be less than max amount")
            }
            return true;
        }),
];

const editCostValidators = [
    check("costName")
        .notEmpty().withMessage('Cost name is required')
        .custom(async (value, { req }) => {
            const cost = await Costo.findOne({ costName: value });
            if (!cost) {
                throw new NotFoundError('Cost does not exist');
            }
            return true;
        }),
    check('category')
        .optional({ checkFalsy: true })
        .isIn(['Dueño', 'Gerente', 'Vendedor', 'vendedor virtual']).withMessage('Invalid category'),
    check('commission')
        .optional({ checkFalsy: true })
        .isIn(['Aumento porcentual', 'Aumento por costo fijo']).withMessage('Invalid commission'),
    check('amount')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Amount must be a number'),
    check()
        .custom(async (value, { req }) => {
            const {amount, minAmount, maxAmount } = req.body;
            console.log("amount: ", amount);
            console.log("minAmount: ", minAmount);
            console.log("maxAmount: ", maxAmount);
            if(amount && (minAmount || maxAmount)){
                throw new BadRequestError("Incoherent amounts")
            }
            if(!amount && !(minAmount && maxAmount)){
                throw new BadRequestError("Both min and max amounts must be provided")
            }
            if(parseFloat(minAmount) >= parseFloat(maxAmount)){
                throw new BadRequestError("Min amount must be less than max amount")
            }
            return true;
        }),
    check()
        .custom((value, { req }) => {
            const { category, commission, amount, minAmount, maxAmount } = req.body;
            if (!category && !commission && !amount) {
                throw new BadRequestError("There should be at least one field to update.")
            }
            return true;
        })
];

const deleteCostValidators = [
    check("costName")
        .notEmpty().withMessage('Cost name is required')
        .custom(async (value, { req }) => {
            const cost = await Costo.findOne({ costName: value });
            if (!cost) {
                throw new NotFoundError('Cost does not exist');
            }
            return true;
        }),
];

async function showCostsView(req, res, next) {
    try {
        const costs = await Costo.find({}).lean();
        res.render('vistaCostos', {
            costs: costs
        });
    } catch (err) {
        return next(err);
    }
}

async function createCost(req, res, next) {
    const { costName, category, commission, amount, minAmount, maxAmount } = req.body;
    const costToAdd = new Costo({
        costName,
        category,
        commission,
        amount,
        minAmount,
        maxAmount 
    });

    try {
        await costToAdd.save();

        res.status(200).json({ success: true, message: "Costo agregado con éxito" });
    } catch (err) {
        console.log(err);
        return next(err);
    }
}

async function editCost(req, res, next) {
    const { costName, category, commission, amount, minAmount, maxAmount } = req.body;
    const updateFields = {};
    if (category) { updateFields.category = category; }
    if (commission) { updateFields.commission = commission; }
    if (amount) { updateFields.amount = amount; } else { updateFields.amount = 0; }
    if (minAmount) { updateFields.minAmount = minAmount; } else { updateFields.minAmount = 0; }
    if (maxAmount) { updateFields.maxAmount = maxAmount; } else { updateFields.maxAmount = 0; }

    try {
        const costToUpdate = await Costo.findOneAndUpdate({ costName }, updateFields, { new: true });
        if (!costToUpdate) {
            throw new NotFoundError("Cost not found");
        }

        res.status(200).json({ success: true, message: "Costo editado con éxito" });
    } catch (err) {
        return next(err);
    }
}

async function deleteCost(req, res, next) {
    const { costName } = req.body;

    try {
        const costToDelete = await Costo.findOneAndDelete({ costName });
        if (!costToDelete) {
            throw new NotFoundError("Cost not found");
        }

        res.status(200).json({ success: true, message: "Costo eliminado con éxito"});
    } catch(err) {
        return next(err);
    }  
}

module.exports = {
    createCostValidators,
    editCostValidators,
    deleteCostValidators,
    showCostsView,
    createCost,
    editCost,
    deleteCost
}
