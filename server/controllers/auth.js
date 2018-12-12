var db = require("../models/index");
const User = require('../models/user')(db.sequelize, db.Sequelize);
const Researcher = require('../models/researcher')(db.sequelize, db.Sequelize);
const Student = require('../models/student')(db.sequelize, db.Sequelize);
var bcrypt = require('bcrypt-node');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');
const randomstring = require("randomstring");
const { body, validationResult } = require('express-validator/check');

module.exports = {
    validate(method) {
        switch (method) {
            case 'signUp': {
                    return [
                        body('names', 'Los nombres son obligatorios.').not().isEmpty(),
                        body('last_names', 'Los apellidos son obligatorios.').not().isEmpty(),
                        body('email', 'La dirección de correo electrónico es obligatoria.').not().isEmpty(),
                        body('email', 'Dirección de correo electrónico inválida.').isEmail(),
                        body('password', 'La contraseña es obligatoria.').not().isEmpty(),
                        body('passwordMatch', 'La confirmación de contraseña es '
                            + 'obligatoria.').not().isEmpty(),
                        body('accountType', 'El tipo de cuenta solo puede ser '
                            + '"estudiante" o "investigador".')
                            .isIn(['student', 'researcher']),
                        body('email').custom((value) => {
                            return User.findOne({
                                where: {
                                    email: value,
                                }
                            })
                            .then((existingUser) => {
                                if (existingUser)
                                    return Promise.reject('El correo electrónico '
                                        + 'ya ha sido registrado');
                            });
                        }),
                        body('password').custom((value, { req }) => {
                            if (value != req.body.passwordMatch)
                                return Promise.reject('Las contraseñas no coinciden');
                            return Promise.resolve();
                        }),
                    ]
                }
                break;
        }
    },
    logInIndex(req, res) {
        if (req.isAuthenticated())
            res.redirect('/')
        else
            res.render('login');
    },
    logIn(req, res) {
        User.findOne({
            where: {
                email: req.body.email,
            },
        })
        .then((user) => {
            if (user === null || !bcrypt.compareSync(req.body.password, user.password))
                res.render('login', {
                    error: 'El correo electrónico o la contraseña son incorrectos'
                });
            else if (user.approved == false) {
                res.render('login', {
                    error: 'La cuenta no ha sido confirmada, verifica tu bandeja de'
                        + ' correo electrónico'
                });
            }
            else
                req.login(user, function(err) {
                    res.redirect('/');
                });
        });
    },
    signUpIndex(req, res) {
        if (req.isAuthenticated())
            res.redirect('/')
        else
            res.render('signup');
    },
    signUp(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('signup', {
                errors: errors.array()
            });
        }
        else {
            User.create({
                names: req.body.names,
                last_names: req.body.last_names,
                email: req.body.email,
                password: bcrypt.hashSync(req.body.password),
                token: randomstring.generate(25),
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .then((user) => {
                let confirmation_link = "http://" + process.env.HOST + ":"
                + process.env.PORT + "/"
                + "confirmacion/" + user.token;
                var emailHTML = path.join(__dirname, "..", "..", "views/email/", "confirm.html");
                emailHTML = fs.readFileSync(emailHTML).toString();
                emailHTML = emailHTML.replace(/{{user.names}}/gm, user.names);
                emailHTML = emailHTML.replace(/{{support_email}}/gm, process.env.support_email);
                emailHTML = emailHTML.replace(/{{confirmation_link}}/gm, confirmation_link);
                sgMail.setApiKey(process.env.sendgrid_api_key);
                sgMail.send({
                    to: user.email,
                    from: process.env.support_email,
                    subject: user.names + ', activa tu cuenta',
                    html: emailHTML,
                })
                .then(() => {
                    if (req.body.accountType == "student") {
                        Student.create({
                            user_id: user.id,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                    }
                    else if (req.body.accountType == "researcher") {
                        Researcher.create({
                            user_id: user.id,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                    }
                    res.render('login');
                });
            })
            .catch(error => res.status(400).send(error));
        }
    },
    logOut(req, res){

        req.logout();
        req.session.destroy();
        res.redirect('/');

    },
    confirmation(req, res) {
        User.findOne({
            where: {
                token: req.params.ficha,
            }
        })
        .then((user) => {
            if (!user)
                return res.status(404).send({
                    error: 'No existe un usuario con esa ficha de confirmación',
                });
            return user
                .update({
                    approved: true,
                })
                .then(() => res.render('login', {
                    success: "Cuenta confirmada correctamente",
                }))
                .catch((error) => res.render('/', {
                    error: error,
                }));
        })
        .catch((error) => res.status(400).send(error));
    },
};
