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
        .isIn(['Dueño', 'Gerente', 'Vendedor']).withMessage('Invalid category'),
    check('commission')
        .notEmpty().withMessage('Commission is required')
        .isIn(['Aumento porcentual', 'Aumento por costo fijo']).withMessage('Invalid commission'),
    check('amount')
        .notEmpty().withMessage('Amount is required')
        .isNumeric().withMessage('Amount must be a number')
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
        .isIn(['Dueño', 'Gerente', 'Vendedor']).withMessage('Invalid category'),
    check('commission')
        .optional({ checkFalsy: true })
        .isIn(['Aumento porcentual', 'Aumento por costo fijo']).withMessage('Invalid commission'),
    check('amount')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Amount must be a number'),
    check()
        .custom((value, { req }) => {
            const { category, commission, amount } = req.body;
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
            layout: 'costos',
            costs: costs
        });
    } catch (err) {
        return next(err);
    }
}

async function createCost(req, res, next) {
    const { costName, category, commission, amount } = req.body;
    const costToAdd = new Costo({
        costName,
        category,
        commission,
        amount
    });

    try {
        await costToAdd.save();

        console.log("Costo agregado con éxito");
        res.status(200).json({ costToAdd });
    } catch (err) {
        console.log(err);
        return next(err);
    }
}

async function editCost(req, res, next) {
    const { costName, category, commission, amount } = req.body;
    const updateFields = {};
    if (category) { updateFields.category = category; }
    if (commission) { updateFields.commission = commission; }
    if (amount) { updateFields.amount = amount; }

    try {
        const costToUpdate = await Costo.findOneAndUpdate({ costName }, updateFields, { new: true });
        if (!costToUpdate) {
            throw new NotFoundError("Cost not found");
        }

        console.log("Costo editado con éxito");
        res.status(200).json({ costToUpdate });
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

        console.log("Costo eliminado con éxito");
        res.status(200).json({ success: true });
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
