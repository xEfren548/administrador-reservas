async function showApprovalsView(req, res, next) {
    try {
        const privilege = req.session.privilege;

        if (privilege !== "Administrador") {
            throw new Error("El usuario no tiene permiso para ver la pantalla de aprobaciones");
        }

        res.render('aprobacionesView');

    } catch (error) {
        console.log(error);
        return next(error);
    }
}

module.exports = {
    showApprovalsView
}