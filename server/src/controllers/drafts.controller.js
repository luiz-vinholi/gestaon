const utils = require('../utils')
const _ = require('lodash')
const Op = require('sequelize').Op
const shortid = require('shortid')
const restify = require('restify')
const Controller = require('./../models/Controller')

module.exports = (server) => {

    ///////////////////////
    ///   CONTROLLERS   ///
    ///////////////////////
    //
    const clientsController = require('./../controllers/clients.controller')(server)
    const addressesController = require('./../controllers/addresses.controller')(server)
    const customFieldsController = require('./../controllers/custom-fields.controller')(server)
    const productsController = require('./../controllers/products.controller')(server)
    const suppliersController = require('./../controllers/suppliers.controller')(server)

    //  <-- end CONTORLLERS

    return {

        ////////////////
        ///   CRUD   ///
        ////////////////
        //
        getOne(draftId) {
            return server.mongodb.Draft.findOne({ draftId: draftId }).then((draft) => {
                draft = JSON.parse(JSON.stringify(draft))
                return draft
            })
        },

        getAll(req) {
            return server.mongodb.Draft.find({ companyId: req.query.companyId }).then((drafts) => {
                drafts = JSON.parse(JSON.stringify(drafts))
                return server.mysql.User.findAll({
                    include: [{
                        model: server.mysql.CompanyUser,
                        as: 'userCompanies',
                        where: {
                            companyId: req.query.companyId
                        }
                    }]
                }).then((user) => {
                    _.map(drafts, (draft, index) => {
                        _.find(user, (userDraft) => {
                            if (userDraft.id === draft.createdBy) {
                                drafts[index] = _.assignIn(draft, { createdBy: userDraft.name })
                            }
                        })
                    })
                    return drafts
                }).catch((err) => {
                    err
                })
            })
        },

        createOne: (controller) => {
            return server.mongodb.Draft.findOne().sort({ _id: -1 }).then((draftIdNext) => {
                if (draftIdNext) {
                    return draftIdNext.draftId + 1
                }
                return 1
            }).then((seq) => {
                let setData = {}
                setData.draftId = seq
                setData.createdBy = parseInt(controller.request.createdBy.id),
                    setData.companyId = controller.request.companyId,
                    setData.type = controller.request.type,
                    setData.presence = []

                if(controller.request.recoverance){
                    // temporary until generic file is created
                    let type = {}
                    if(setData.type === 'request'){
                        type.name = 'client'
                        type.Addresses = 'clientAddresses'
                        type.Phones = 'clientPhones'
                        type.CustomFields = 'clientCustomFields'
                    }
                    else if(setData.type === 'expense'){
                        type.name = 'supplier'
                        type.Addresses = 'supplierAddresses'
                        type.Phones = 'supplierPhones'
                        type.CustomFields = 'supplierCustomFields'
                    }
                    setData.recoverancedBy = parseInt(controller.request.recoverancedBy.id)
                    setData.form = {id: controller.request.recoverance.id, activeStep: null, [type.name]: controller.request[type.name], order: controller.request.order, task: controller.request.task }
                }
                else{
                    const draftFormModel = new server.draftFormModels[_.upperFirst(_.camelCase(setData.type))]()
                    draftFormModel.setCompanyId(controller.request.companyId)
                    if(setData.type == 'request'){
                        draftFormModel.setUser(parseInt(controller.request.createdBy.id)) // initial user to request 
                        draftFormModel.setStatus("pending") // status in initial request timeline
                    }

                    setData.form = draftFormModel.getObject()
                    setData.isSingle = draftFormModel.isSingle()
                }

                setData.data = { company: null, client: null }

                return server.mongodb.Draft.create(setData).then((draft) => {

                    draft = JSON.parse(JSON.stringify(draft))

                    console.log("Created draft", draft)
                    draft = _.assignIn(draft, { createdBy: controller.request.createdBy.name, recoverancedBy: (controller.request.recoverancedBy) ? controller.request.recoverancedBy.name : null })
                    // change createdBy to user name for emit to all users

                    // check socket connections and emit 
                    let ids = Object.keys(server.io.sockets.connected)
                    ids.forEach(function (id) {
                        const socket = server.io.sockets.connected[id]

                        if (_.includes(socket.user.companies, parseInt(controller.request.companyId))) {
                            socket.join('draft/' + draft.draftId)
                        }
                        const companyActiveId = (socket.user.activeCompanyUserId) ? socket.user.activeCompanyUserId : socket.user.companies[0]
                        if (parseInt(controller.request.companyId) === parseInt(companyActiveId)) {
                            socket.emit('draftCreated', { data: draft, emittedBy: (controller.request.recoverancedBy) ? parseInt(controller.request.recoverancedBy.id) : parseInt(controller.request.createdBy.id) })
                        }
                    })

                    return draft
                }).catch((err) => {
                    console.log("Error", err)
                    return err
                });
            })
        },

        updateDraft(draftReq) {
            return new Promise((resolve, reject) => {
                server.mongodb.Draft.findOne({ draftId: draftReq.draftId }).then((draftConsult) => {
                    const path = draftReq.path
                    delete draftReq.path

                    if (draftReq.hasArray) {
                        delete draftReq.hasArray

                        return new Promise((resolve, reject) => {
                            let update = []
                            _.get(draftConsult, 'form.' + path).map((value, index) => {
                                const arrayIndex = _.findIndex(_.get(draftReq, 'form.' + path), {id: value.id})
                                if(arrayIndex !== -1){
                                    update.push(_.assign(value, _.get(draftReq, 'form.' + path)[arrayIndex]))
                                }
                                else {
                                    update.push(value)
                                }
                            })
                            resolve(update)
                        }).then((update) => {
                            _.set(draftReq, 'form.' + path,
                                update
                            )
                            resolve(_.mergeWith(draftConsult.form, draftReq.form))
                        })
                    }
                    else {
                        resolve(_.mergeWith(draftConsult.form, draftReq.form))
                    }
                }).catch((err) => {
                    reject(err)
                })
            }).then((draftObjUpdate) => {
                return server.mongodb.Draft.update({ draftId: draftReq.draftId }, { $set: { form: draftObjUpdate } }).then((draft) => {
                    return draft
                }).catch((err) => {
                    console.log(err)
                    return err
                });
            })
        },

        removeAll() {
            server.mongodb.Draft.remove({}, (err, service) => {
                if (err) {
                    return next(
                        new restify.InternalServerError({
                            body: {
                                "code": err.name,
                                "message": err.message,
                                "detailed": err
                            }
                        })
                    );
                };
                return res.send(200, {
                    data: "OK"
                });
            });
        },
        // <-- end CRUD

        /////////////////////
        ///   PRESENCES   ///
        /////////////////////
        //
        checkPresence(draftId) {
            return server.mongodb.Draft.findOne({ draftId: draftId }).then((draft) => {
                draft = JSON.parse(JSON.stringify(draft))
                return (draft.presence) ? draft.presence : null
            })
        },

        checkAllPresence() {
            return server.mongodb.Draft.find({}).then((drafts) => {
                let presenceUsers = []
                drafts.forEach((draft) => {
                    presenceUsers.push({ draftId: draft.draftId, presence: draft.presence })
                })
                return presenceUsers
            })
        },

        newPresenceUser(draftId, objPresenceUser) {
            return new Promise((resolve, reject) => {
                server.mongodb.Draft.findOne({ draftId: draftId }).then((draftConsult) => {
                    draftConsult.presence.push(objPresenceUser)
                    resolve(draftConsult.presence)
                }).catch((err) => {
                    reject(err)
                })
            }).then((presenceUpdate) => {
                return this.savePresenceUser(draftId, presenceUpdate).then(() => {
                    return presenceUpdate
                })
            })
        },

        savePresenceUser(draftId, presenceUpdate) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.update({ draftId: draftId }, { $set: { presence: presenceUpdate } }).then((draft) => {
                    resolve(presenceUpdate)
                }).catch((err) => {
                    reject(err)
                })
            }).then((updatedPresence) => {
                return updatedPresence
            })
        },
        // <-- end PRESENCES

        ///////////////////////
        ///     CLIENT      ///
        ///////////////////////
//
        selectClient(clientSelect) {
            return this.getOne(clientSelect.draftId).then((draft) => {
                const controller = new Controller({
                    request: {
                        id: clientSelect.clientId
                    }
                })

                return clientsController.getOne(controller).then((client) => {
                    client = JSON.parse(JSON.stringify(client))
                    const update = _.assign(draft.form, { client: client, clientAddressForm: {}, clientAddressId: null })
                    return server.mongodb.Draft.update({ draftId: clientSelect.draftId }, { $set: { form: update } }).then(() => {
                        return client
                    })
                })
            })
        },

        resetClient(clientReset) {
            return this.getOne(clientReset.draftId).then((draft) => {
                const update = _.assign(draft.form, { client: { id: null,  name: null, legalDocument: null, clientAddresses: [], clientPhones: [], clientCustomFields: [], isNull: true }, clientAddressForm: {}, clientAddressId: null})
                return server.mongodb.Draft.update({ draftId: clientReset.draftId }, { $set: { form: update } }).then(() => {
                    return null
                })
            })
        },

        ///////////////////////
        ///     CLIENT      ///
        ///  ** address     ///
        ///////////////////////
        //

        clientAddressEdit(addressEdit) {
            return this.getOne(addressEdit.draftId).then((draft) => {
                const update = _.assign(draft.form, { clientAddressForm: {id: addressEdit.clientAddressId} })
                return server.mongodb.Draft.update({ draftId: addressEdit.draftId }, { $set: { form: update } }).then(() => {
                    return true
                })
            })
        },

        clientAddressBack(addressBack) {
            return this.getOne(addressBack.draftId).then((draft) => {
                const update = _.assign(draft.form, { clientAddressForm: {} })
                return server.mongodb.Draft.update({ draftId: addressBack.draftId }, { $set: { form: update } }).then(() => {
                    return null
                })
            })
        },

        saveClientAddress(clientAddressSave) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: clientAddressSave.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))

                    const index = _.findIndex(draft.form.client.clientAddresses, (clientAddress) => {
                        return clientAddress.id === draft.form.clientAddressForm.id
                    })
                    let saveClientAddresses = draft.form.client.clientAddresses
                    let update = {}

                    if (index !== -1) {
                        const address = _.assign(saveClientAddresses[index].address, draft.form.clientAddressForm.address)
                        const clientAddressForm = _.assign(draft.form.clientAddressForm, { address: address })
                        saveClientAddresses[index] = _.assign(saveClientAddresses[index], clientAddressForm)
                        update.addressClientReturn = _.assign(saveClientAddresses[index], clientAddressForm)
                    }
                    else {
                        saveClientAddresses.push(_.assign(draft.form.clientAddressForm, { id: (draft.form.clientAddressForm.id) ? draft.form.clientAddressForm.id : 'temp:' + shortid.generate() }))
                        update.addressClientReturn = draft.form.clientAddressForm
                    }

                    const client = _.assign(draft.form.client, { clientAddresses: saveClientAddresses })
                    update.form = _.assign(draft.form, { client: client, clientAddressForm: {} })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: clientAddressSave.draftId }, { $set: { form: save.form } }).then(() => {
                    return save.addressClientReturn
                })
            })
        },

        removeClientAddress(clientAddressRemove) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: clientAddressRemove.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))
                    let update = {}
                    update.saveClientAddresses = _.filter(draft.form.client.clientAddresses, (clientAddress) => {
                        return clientAddress.id !== clientAddressRemove.clientAddressId
                    })

                    let isNull = false
                    if(!update.saveClientAddresses.length){
                        if(!draft.form.client.clientPhones.length && !draft.form.client.clientCustomFields.length && _.isEmpty(draft.form.client.name) && _.isEmpty(draft.form.client.legalDocument)){
                            isNull = true
                        }
                    }

                    update.clientAddressId = clientAddressRemove.clientAddressId
                    const selectedClientAddressId = (draft.form.clientAddressId === clientAddressRemove.clientAddressId) ? null : draft.form.clientAddressId
                    const client = _.assign(draft.form.client, { clientAddresses: update.saveClientAddresses, isNull})
                    update.form = _.assign(draft.form, { client: client, clientAddressForm: {}, clientAddressId: selectedClientAddressId })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: clientAddressRemove.draftId }, { $set: { form: save.form } }).then(() => {
                    return save
                })
            })
        },

        ///////////////////////////////
        //CLIENT ADDRESS => ADDRESS  //
        ///////////////////////////////

        //
        selectAddressClientAddress(addressSelect) {
            return this.getOne(addressSelect.draftId).then((draft) => {

                const controller = new Controller({
                    request: {
                        id: addressSelect.addressId
                    }
                })

                return addressesController.getOne(controller).then((address) => {
                    address = JSON.parse(JSON.stringify(address))


                    const clientAddressForm = _.assign(draft.form.clientAddressForm, { id: (addressSelect.clientAddressId) ? addressSelect.clientAddressId : null, address: address })
                    const update = _.assign(draft.form, { clientAddressForm: clientAddressForm })

                    return server.mongodb.Draft.update({ draftId: addressSelect.draftId }, { $set: { form: update } }).then(() => {
                        return address
                    })
                })
            })
        },

        resetAddressClientAddress(addressReset) {
            return this.getOne(addressReset.draftId).then((draft) => {
                const formAddress = _.assign(draft.form.clientAddressForm, { address: {} })
                const update = _.assign(draft.form, { clientAddressForm: formAddress })
                return server.mongodb.Draft.update({ draftId: addressReset.draftId }, { $set: { form: update } }).then(() => {
                    return null
                })
            })
        },
        // <--- end CLIENT ADDRESS => ADDRESS | CLIENT ** address

        //  <-- end CLIENT ** address

        ///////////////////////
        ///     CLIENT      ///
        ///  ** phone       ///
        ///////////////////////
        //
        phoneEditionCancel(phoneEditionCancel) {
            return this.getOne(phoneEditionCancel.draftId).then((draft) => {
                const update = _.assign(draft.form, { clientPhoneForm: {} })
                return server.mongodb.Draft.update({ draftId: phoneEditionCancel.draftId }, { $set: { form: update } }).then(() => {
                    return null
                })
            })
        },

        saveClientPhone(clientPhoneSave) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: clientPhoneSave.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))
                    const index = _.findIndex(draft.form.client.clientPhones, (clientPhone) => {
                        return clientPhone.id === draft.form.clientPhoneForm.id
                    })
                    let saveClientPhones = draft.form.client.clientPhones
                    let update = {}

                    if (index !== -1) {
                        saveClientPhones[index] = _.assign(saveClientPhones[index], draft.form.clientPhoneForm)
                        update.phoneClientReturn = _.assign(saveClientPhones[index], draft.form.clientPhoneForm)
                    }
                    else {
                        saveClientPhones.push(_.assign(draft.form.clientPhoneForm, { id: (draft.form.clientPhoneForm.id) ? draft.form.clientPhoneForm.id : 'temp:' + shortid.generate() }))
                        update.phoneClientReturn = draft.form.clientPhoneForm
                    }

                    const client = _.assign(draft.form.client, { clientPhones: saveClientPhones })
                    update.form = _.assign(draft.form, { client: client, clientPhoneForm: {} })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: clientPhoneSave.draftId }, { $set: { form: save.form } }).then(() => {
                    return save.phoneClientReturn
                })
            })
        },

        removeClientPhone(clientPhoneRemove) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: clientPhoneRemove.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))
                    let update = {}
                    update.saveClientPhones = _.filter(draft.form.client.clientPhones, (clientPhone) => {
                        return clientPhone.id !== clientPhoneRemove.clientPhoneId
                    })

                    let isNull = false
                    if(!update.saveClientPhones.length){
                        if(!draft.form.client.clientAddresses.length && !draft.form.client.clientCustomFields.length && _.isEmpty(draft.form.client.name) && _.isEmpty(draft.form.client.legalDocument)){
                            isNull = true
                        }
                    }

                    update.clientPhoneId = clientPhoneRemove.clientPhoneId

                    const client = _.assign(draft.form.client, { clientPhones: update.saveClientPhones, isNull })
                    update.form = _.assign(draft.form, { client: client, clientPhoneForm: {} })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: clientPhoneRemove.draftId }, { $set: { form: save.form } }).then(() => {
                    return save.clientPhoneId
                })
            })
        },

        //  <--- end CLIENT ** phone

        ///////////////////////
        ///     CLIENT      ///
        /// ** customField  ///
        ///////////////////////
        //    
        clientCustomFieldAdd(clientCustomFieldAdd) {
            return this.getOne(clientCustomFieldAdd.draftId).then((draft) => {

                return new Promise((resolve, reject) => {
                    if (!_.isInteger(clientCustomFieldAdd.customFieldId)) {
                        const checkCustomFieldId = clientCustomFieldAdd.customFieldId.split(':')
                        if (_.first(checkCustomFieldId) === 'temp') {
                            const index = _.findIndex(draft.data.company.customFields, { id: clientCustomFieldAdd.customFieldId })

                            resolve(draft.data.company.customFields[index])
                        }
                    }
                    else {
                        const controller = new Controller({
                            request: {
                                customFieldId: clientCustomFieldAdd.customFieldId,
                                companyId: (clientCustomFieldAdd.user.activeCompanyUserId) ? clientCustomFieldAdd.user.activeCompanyUserId : clientCustomFieldAdd.user.companies[0]
                            }
                        })

                        customFieldsController.getOne(controller).then((customField) => {
                            resolve(JSON.parse(JSON.stringify(customField)))
                        })
                    }
                }).then((addCustomField) => {

                    if (addCustomField || addCustomField.length > 1) {
                        let update = {}
                        let saveClientCustomFields = (draft.form.client.clientCustomFields) ? draft.form.client.clientCustomFields : []

                        update.clientCustomField = { id: 'temp:' + shortid.generate(),
                            clientId: (clientCustomFieldAdd.clientId) ? clientCustomFieldAdd.clientId : null,
                            value: null,
                            customField: addCustomField
                        }
                        const client = _.assign(draft.form.client, { clientCustomFields: _.concat(saveClientCustomFields, update.clientCustomField) })
                        update.form = _.assign(draft.form, { client: client })

                        return server.mongodb.Draft.update({ draftId: clientCustomFieldAdd.draftId }, { $set: { form: update.form } }).then(() => {
                            return update
                        })
                    }
                    else {
                        return { clientCustomField: 'Erro na consulta do custom Field' }
                    }
                })
            })

        },

        clientCustomFieldRemove(clientCustomFieldRemove) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: clientCustomFieldRemove.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))
                    let update = {}
                    update.saveClientCustomFields = _.filter(draft.form.client.clientCustomFields, (clientCustomField) => {
                        return clientCustomField.id !== clientCustomFieldRemove.clientCustomFieldId
                    })

                    update.clientCustomFieldId = clientCustomFieldRemove.clientCustomFieldId

                    const client = _.assign(draft.form.client, { clientCustomFields: update.saveClientCustomFields })
                    update.form = _.assign(draft.form, { client: client })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: clientCustomFieldRemove.draftId }, { $set: { form: save.form } }).then(() => {
                    return save
                })
            })
        },
        //  <--- end CLIENT ** customField


        ///////////////////////
        ///  CUSTOM FIELD   ///
        /// ** in company   ///
        ///////////////////////
        //    
        customFieldChange(customFieldChange) {
            return this.getOne(customFieldChange.draftId).then((draft) => {

                if (!draft.data.company) {
                    draft.data.company = { customFields: null }
                }

                const index = _.findIndex(draft.data.company.customFields, (customField) => {
                    return customField.id === (customFieldChange.customFieldId) ? customFieldChange.customFieldId : null
                })

                let saveCustomFields = (draft.data.company.customFields) ? draft.data.company.customFields : []
                let update = {}

                update.customField = {
                    id: (customFieldChange.customFieldId) ? customFieldChange.customFieldId : 'temp:' + shortid.generate(),
                    name: _.toUpper(customFieldChange.name),
                    companyId: (customFieldChange.user.activeCompanyUserId) ? customFieldChange.user.activeCompanyUserId : customFieldChange.user.companies[0],
                    remove: (customFieldChange.remove) ? true : false
                }

                if (index !== -1) {
                    saveCustomFields[index] = _.assign(saveCustomFields[index], update.customField)
                    update.customFieldReturn = _.assign(saveCustomFields[index], update.customField)
                }
                else {
                    saveCustomFields.push(update.customField)
                    update.customFieldReturn = update.customField
                }

                const company = _.assign(draft.data.company, { customFields: saveCustomFields })
                update.data = _.assign(draft.data, { company: company })

                return server.mongodb.Draft.update({ draftId: customFieldChange.draftId }, { $set: { data: update.data } }).then(() => {
                    return update
                })
            })
        },

        // <-- end CUSTOM FIELD ** in company

        ///////////////////////
        ///  CLIENT GROUP   ///
        /// ** in company   ///
        ///////////////////////
        //    
        clientGroupChange(clientGroupChange) {
            return this.getOne(clientGroupChange.draftId).then((draft) => {

                if (!draft.data.company) {
                    draft.data.company = { clientGroups: null }
                }

                const index = _.findIndex(draft.data.company.clientGroups, (clientGroup) => {
                    return clientGroup.id === (clientGroupChange.clientGroupId) ? clientGroupChange.clientGroupId : null
                })

                let saveClientGroups = (draft.data.company.clientGroups) ? draft.data.company.clientGroups : []
                let update = {}

                update.clientGroup = {
                    id: (clientGroupChange.clientGroupId) ? clientGroupChange.clientGroupId : 'temp:' + shortid.generate(),
                    name: _.toUpper(clientGroupChange.name),
                    companyId: (clientGroupChange.user.activeCompanyUserId) ? clientGroupChange.user.activeCompanyUserId : clientGroupChange.user.companies[0],
                    remove: (clientGroupChange.remove) ? true : false
                }

                if (index !== -1) {
                    saveClientGroups[index] = _.assign(saveClientGroups[index], update.clientGroup)
                    update.clientGroupReturn = _.assign(saveClientGroups[index], update.clientGroup)
                }
                else {
                    saveClientGroups.push(update.clientGroup)
                    update.clientGroupReturn = update.clientGroup
                }

                const company = _.assign(draft.data.company, { clientGroups: saveClientGroups })
                update.data = _.assign(draft.data, { company: company })

                return server.mongodb.Draft.update({ draftId: clientGroupChange.draftId }, { $set: { data: update.data } }).then(() => {
                    return update
                })
            })
        },

        // <-- end CUSTOM FIELD ** in company

//  <-- end CLIENT

        //////////////////////
        ///     ORDER      ///
        //////////////////////

//
        //////////////////////
        ///     ORDER      ///
        /// ** product     ///
        //////////////////////

        orderProductAdd(orderProductAdd) {
            return this.getOne(orderProductAdd.draftId).then((draft) => {
                const orderProduct = {id: 'temp:' + shortid.generate()}

                draft.form.order.orderProducts.push(orderProduct)

                const order = _.assign(draft.form.order, {orderProducts: draft.form.order.orderProducts})
                const update = _.assign(draft.form, { order: order })

                return server.mongodb.Draft.update({ draftId: orderProductAdd.draftId }, { $set: { form: update } }).then(() => {
                    return orderProduct
                })
            })
        },

        orderProductRemove(orderProductRemove) {
            return this.getOne(orderProductRemove.draftId).then((draft) => {

                let orderProducts = _.filter(draft.form.order.orderProducts, (orderProduct) => {
                    return orderProduct.id !== orderProductRemove.id
                })

                const order = _.assign(draft.form.order, {orderProducts: orderProducts})
                const update = _.assign(draft.form, { order: order })

                return server.mongodb.Draft.update({ draftId: orderProductRemove.draftId }, { $set: { form: update } }).then(() => {
                    return true
                })
            })
        },

        selectProductOrderProduct(productSelect) {
            return this.getOne(productSelect.draftId).then((draft) => {

                const controller = new Controller({
                    request: {
                        id: productSelect.productId
                    }
                })

                return productsController.getOne(controller).then((product) => {
                    product = JSON.parse(JSON.stringify(product))

                    const arrayIndex = _.findIndex(draft.form.order.orderProducts, {id: productSelect.orderProductId})

                    draft.form.order.orderProducts[arrayIndex] = _.assign(draft.form.order.orderProducts[arrayIndex], {product: product}, {productId: product.id})

                    const update = _.assign(draft.form, { order: draft.form.order })

                    return server.mongodb.Draft.update({ draftId: productSelect.draftId }, { $set: { form: update } }).then(() => {
                        return {product: product, orderProductId: productSelect.orderProductId}
                    })
                })
            })

        },

        resetProductOrderProduct(productReset) {
            return this.getOne(productReset.draftId).then((draft) => {

                const arrayIndex = _.findIndex(draft.form.order.orderProducts, {id: productReset.orderProductId})

                draft.form.order.orderProducts[arrayIndex] = _.assign(draft.form.order.orderProducts[arrayIndex], {product: {}}, {productId: null})

                const update = _.assign(draft.form, { order: draft.form.order })

                return server.mongodb.Draft.update({ draftId: productReset.draftId }, { $set: { form: update } }).then(() => {
                    return {orderProductId: productReset.orderProductId}
                })
            })

        },

// <-- end ORDER

        ///////////////////////
        ///    SUPPLIER     ///
        ///////////////////////
//
        selectSupplier(supplierSelect) {
            return this.getOne(supplierSelect.draftId).then((draft) => {

                const controller = new Controller({
                    request: {
                        id: supplierSelect.supplierId
                    }
                })

                return suppliersController.getOne(controller).then((supplier) => {
                    const update = _.assign(draft.form, { supplier: supplier, supplierAddressForm: {}, supplierAddressId: null })
                    return server.mongodb.Draft.update({ draftId: supplierSelect.draftId }, { $set: { form: update } }).then(() => {
                        return supplier
                    })
                })
            })
        },

        resetSupplier(supplierReset) {
            return this.getOne(clientReset.draftId).then((draft) => {
                const update = _.assign(draft.form, { supplier: { id: null,  name: null, legalDocument: null, supplierAddresses: [], supplierPhones: [], supplierCustomFields: [], isNull: true }, supplierAddressForm: {}, supplierAddressId: null})
                return server.mongodb.Draft.update({ draftId: clientReset.draftId }, { $set: { form: update } }).then(() => {
                    return null
                })
            })
        },

        ///////////////////////
        ///    SUPPLIER     ///
        ///  ** address     ///
        ///////////////////////
        //

        supplierAddressEdit(addressEdit) {
            return this.getOne(addressEdit.draftId).then((draft) => {
                const update = _.assign(draft.form, { supplierAddressForm: {id: addressEdit.supplierAddressId} })
                return server.mongodb.Draft.update({ draftId: addressEdit.draftId }, { $set: { form: update } }).then(() => {
                    return true
                })
            })
        },

        supplierAddressBack(addressBack) {
            return this.getOne(addressBack.draftId).then((draft) => {
                const update = _.assign(draft.form, { supplierAddressForm: {} })
                return server.mongodb.Draft.update({ draftId: addressBack.draftId }, { $set: { form: update } }).then(() => {
                    return null
                })
            })
        },

        saveSupplierAddress(supplierAddressSave) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: supplierAddressSave.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))

                    const index = _.findIndex(draft.form.supplier.supplierAddresses, (supplierAddress) => {
                        return supplierAddress.id === draft.form.supplierAddressForm.id
                    })
                    let saveSupplierAddresses = draft.form.supplier.supplierAddresses
                    let update = {}

                    if (index !== -1) {
                        const address = _.assign(saveSupplierAddresses[index].address, draft.form.supplierAddressForm.address)
                        const supplierAddressForm = _.assign(draft.form.supplierAddressForm, { address: address })
                        saveSupplierAddresses[index] = _.assign(saveSupplierAddresses[index], supplierAddressForm)
                        update.addressSupplierReturn = _.assign(saveSupplierAddresses[index], supplierAddressForm)
                    }
                    else {
                        saveSupplierAddresses.push(_.assign(draft.form.supplierAddressForm, { id: (draft.form.supplierAddressForm.id) ? draft.form.supplierAddressForm.id : 'temp:' + shortid.generate() }))
                        update.addressSupplierReturn = draft.form.supplierAddressForm
                    }

                    const supplier = _.assign(draft.form.supplier, { supplierAddresses: saveSupplierAddresses })
                    update.form = _.assign(draft.form, { supplier: supplier, supplierAddressForm: {} })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: supplierAddressSave.draftId }, { $set: { form: save.form } }).then(() => {
                    return save.addressSupplierReturn
                })
            })
        },

        removeSupplierAddress(supplierAddressRemove) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: supplierAddressRemove.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))
                    let update = {}
                    update.saveSupplierAddresses = _.filter(draft.form.supplier.supplierAddresses, (supplierAddress) => {
                        return supplierAddress.id !== supplierAddressRemove.supplierAddressId
                    })

                    let isNull = false
                    if(!update.saveSupplierAddresses.length){
                        if(!draft.form.supplier.supplierPhones.length && !draft.form.supplier.supplierCustomFields.length && _.isEmpty(draft.form.supplier.name) && _.isEmpty(draft.form.supplier.legalDocument)){
                            isNull = true
                        }
                    }

                    update.supplierAddressId = supplierAddressRemove.supplierAddressId
                    const selectedSupplierAddressId = (draft.form.supplierAddressId === supplierAddressRemove.supplierAddressId) ? null : draft.form.supplierAddressId
                    const supplier = _.assign(draft.form.supplier, { supplierAddresses: update.saveSupplierAddresses, isNull})
                    update.form = _.assign(draft.form, { supplier: supplier, supplierAddressForm: {}, supplierAddressId: selectedSupplierAddressId })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: supplierAddressRemove.draftId }, { $set: { form: save.form } }).then(() => {
                    return save
                })
            })
        },
        //

        /////////////////////////////////
        // SUPPLIER ADDRESS => ADDRESS //
        /////////////////////////////////

        //
        selectAddressSupplierAddress(addressSelect) {
            return this.getOne(addressSelect.draftId).then((draft) => {

                const controller = new Controller({
                    request: {
                        id: addressSelect.addressId
                    }
                })

                return addressesController.getOne(req).then((address) => {
                    address = JSON.parse(JSON.stringify(address))


                    const supplierAddressForm = _.assign(draft.form.supplierAddressForm, { id: (addressSelect.supplierAddressId) ? addressSelect.supplierAddressId : null, address: address })
                    const update = _.assign(draft.form, { supplierAddressForm: supplierAddressForm })

                    return server.mongodb.Draft.update({ draftId: addressSelect.draftId }, { $set: { form: update } }).then(() => {
                        return address
                    })
                })
            })
        },

        resetAddressSupplierAddress(addressReset) {
            return this.getOne(addressReset.draftId).then((draft) => {
                const formAddress = _.assign(draft.form.supplierAddressForm, { address: {} })
                const update = _.assign(draft.form, { supplierAddressForm: formAddress })
                return server.mongodb.Draft.update({ draftId: addressReset.draftId }, { $set: { form: update } }).then(() => {
                    return null
                })
            })
        },
        // <--- end SUPPLIER ADDRESS => ADDRESS | SUPPLIER ** address

        //  <-- end SUPPLIER ** address

        ///////////////////////
        ///   SUPPLIER      ///
        ///  ** phone       ///
        ///////////////////////
        //
        supplierPhoneEditionCancel(phoneEditionCancel) {
            return this.getOne(phoneEditionCancel.draftId).then((draft) => {
                const update = _.assign(draft.form, { supplierPhoneForm: {} })
                return server.mongodb.Draft.update({ draftId: phoneEditionCancel.draftId }, { $set: { form: update } }).then(() => {
                    return null
                })
            })
        },

        saveSupplierPhone(supplierPhoneSave) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: supplierPhoneSave.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))
                    const index = _.findIndex(draft.form.supplier.supplierPhones, (supplierPhone) => {
                        return supplierPhone.id === draft.form.supplierPhoneForm.id
                    })
                    let saveSupplierPhones = draft.form.supplier.supplierPhones
                    let update = {}

                    if (index !== -1) {
                        saveSupplierPhones[index] = _.assign(saveSupplierPhones[index], draft.form.supplierPhoneForm)
                        update.phoneSupplierReturn = _.assign(saveSupplierPhones[index], draft.form.supplierPhoneForm)
                    }
                    else {
                        saveSupplierPhones.push(_.assign(draft.form.supplierPhoneForm, { id: (draft.form.supplierPhoneForm.id) ? draft.form.supplierPhoneForm.id : 'temp:' + shortid.generate() }))
                        update.phoneSupplierReturn = draft.form.supplierPhoneForm
                    }

                    const supplier = _.assign(draft.form.supplier, { supplierPhones: saveSupplierPhones })
                    update.form = _.assign(draft.form, { supplier: supplier, supplierPhoneForm: {} })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: supplierPhoneSave.draftId }, { $set: { form: save.form } }).then(() => {
                    return save.phoneSupplierReturn
                })
            })
        },

        removeSupplierPhone(supplierPhoneRemove) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: supplierPhoneRemove.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))
                    let update = {}
                    update.saveSupplierPhones = _.filter(draft.form.supplier.supplierPhones, (supplierPhone) => {
                        return supplierPhone.id !== supplierPhoneRemove.supplierPhoneId
                    })

                    let isNull = false
                    if(!update.saveSupplierPhones.length){
                        if(!draft.form.supplier.supplierAddresses.length && !draft.form.supplier.supplierCustomFields.length && _.isEmpty(draft.form.supplier.name) && _.isEmpty(draft.form.supplier.legalDocument)){
                            isNull = true
                        }
                    }

                    update.supplierPhoneId = supplierPhoneRemove.supplierPhoneId

                    const supplier = _.assign(draft.form.supplier, { supplierPhones: update.saveSupplierPhones, isNull })
                    update.form = _.assign(draft.form, { supplier: supplier, supplierPhoneForm: {} })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: supplierPhoneRemove.draftId }, { $set: { form: save.form } }).then(() => {
                    return save.supplierPhoneId
                })
            })
        },

        //  <--- end SUPPLIER ** phone

        ///////////////////////
        ///     SUPPLIER    ///
        /// ** customField  ///
        ///////////////////////
        //
        supplierCustomFieldAdd(supplierCustomFieldAdd) {
            return this.getOne(supplierCustomFieldAdd.draftId).then((draft) => {

                return new Promise((resolve, reject) => {
                    if (!_.isInteger(supplierCustomFieldAdd.customFieldId)) {
                        const checkCustomFieldId = supplierCustomFieldAdd.customFieldId.split(':')
                        if (_.first(checkCustomFieldId) === 'temp') {
                            const index = _.findIndex(draft.data.company.customFields, { id: supplierCustomFieldAdd.customFieldId })

                            resolve(draft.data.company.customFields[index])
                        }
                    }
                    else {

                        const controller = new Controller({
                            request: {
                                customFieldId: supplierCustomFieldAdd.customFieldId,
                                companyId: (supplierCustomFieldAdd.user.activeCompanyUserId) ? supplierCustomFieldAdd.user.activeCompanyUserId : supplierCustomFieldAdd.user.companies[0]
                            }
                        })

                        customFieldsController.getOne(controller).then((customField) => {
                            resolve(JSON.parse(JSON.stringify(customField)))
                        })
                    }
                }).then((addCustomField) => {

                    if (addCustomField || addCustomField.length > 1) {
                        let update = {}
                        let saveSupplierCustomFields = (draft.form.supplier.supplierCustomFields) ? draft.form.supplier.supplierCustomFields : []

                        update.supplierCustomField = { id: 'temp:' + shortid.generate(),
                            supplierId: (supplierCustomFieldAdd.supplierId) ? supplierCustomFieldAdd.supplierId : null,
                            value: null,
                            customField: addCustomField
                        }
                        const supplier = _.assign(draft.form.supplier, { supplierCustomFields: _.concat(saveSupplierCustomFields, update.supplierCustomField) })
                        update.form = _.assign(draft.form, { supplier: supplier })

                        return server.mongodb.Draft.update({ draftId: supplierCustomFieldAdd.draftId }, { $set: { form: update.form } }).then(() => {
                            return update
                        })
                    }
                    else {
                        return { supplierCustomField: 'Erro na consulta do custom Field' }
                    }
                })
            })

        },

        supplierCustomFieldRemove(supplierCustomFieldRemove) {
            return new Promise((resolve, reject) => {
                return server.mongodb.Draft.findOne({ draftId: supplierCustomFieldRemove.draftId }).then((draft) => {
                    draft = JSON.parse(JSON.stringify(draft))
                    let update = {}
                    update.saveSupplierCustomFields = _.filter(draft.form.supplier.supplierCustomFields, (supplierCustomField) => {
                        return supplierCustomField.id !== supplierCustomFieldRemove.supplierCustomFieldId
                    })

                    update.supplierCustomFieldId = supplierCustomFieldRemove.supplierCustomFieldId

                    const supplier = _.assign(draft.form.supplier, { supplierCustomFields: update.saveSupplierCustomFields })
                    update.form = _.assign(draft.form, { supplier: supplier })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: supplierCustomFieldRemove.draftId }, { $set: { form: save.form } }).then(() => {
                    return save
                })
            })
        },
        //  <--- end SUPPLIER ** customField

//  <-- end SUPPLIER

        ////////////////////////////////////
        ///                              ///
        ///           ACCOUNTS           ///
        ///                              ///
        ////////////////////////////////////



//       
        ///////////////////////
        ///     REVENUES    ///
        ///  ** payments    ///
        ///////////////////////
        //

        ///////////////////////
        ///     REVENUES    ///
        ///     ** Groups   ///
        ///////////////////////
        //
        addRevenueGroup(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    let saveRevenueGroups = draft.form.revenues.revenueGroups
                    let update = {}

                    update.revenueGroupsReturn = {id: 'temp:' + shortid.generate()}
                    saveRevenueGroups.push(update.revenueGroupsReturn)

                    const revenues = _.assign(draft.form.revenues, { revenueGroups: saveRevenueGroups })
                    update.form = _.assign(draft.form, { revenues: revenues })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                    return save.revenueGroupsReturn
                })
            })

        },

        removeRevenueGroup(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    const check = _.findIndex(draft.form.revenues.revenueItems, (revenueItem) => {
                        return revenueItem.revenueGroupId === data.revenueGroupId
                    })

                    let update = {}

                    if (check !== -1) {
                        update.check = true
                        resolve(update)
                    }
                    else {
                        update.saveRevenueGroup = _.filter(draft.form.revenues.revenueGroups, (revenueGroup) => {
                            return revenueGroup.id !== data.revenueGroupId
                        })

                        update.id = data.revenueGroupId

                        const revenues = _.assign(draft.form.revenues, { revenueGroups: update.saveRevenueGroup })
                        update.form = _.assign(draft.form, { revenues: revenues })

                        resolve(update)
                    }
                })
            }).then((save) => {
                if(save.check){
                    return {
                        success: false,
                        message: "Não é possivel excluir com itens!",
                        errorCode: "ERROR"
                    }
                }
                else{
                    return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                        return {
                            success: true,
                            data: {
                                id: save.id,
                                revenueGroupId: save.id
                            }
                        }
                    })
                }
            })
        },

        //

        ///////////////////////
        ///     REVENUES    ///
        ///     ** Itens    ///
        ///////////////////////
        //
        addRevenueItem(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    const revenueData = JSON.parse(JSON.stringify(data))
                    delete revenueData.draftId

                    let saveRevenueItems = draft.form.revenues.revenueItems
                    let update = {}

                    let positionCheck = _.filter(draft.form.revenues.revenueItems, (revenueItem) => {
                        return revenueItem.revenueGroupId === data.revenueGroupId
                    })

                    const position = (positionCheck.length) ? (_.last(positionCheck).position + 1) : 1

                    update.revenueItemsReturn = _.assign({id: 'temp:' + shortid.generate()}, revenueData, {position: position})
                    
                    saveRevenueItems.push(update.revenueItemsReturn)

                    

                    const revenues = _.assign(draft.form.revenues, { revenueItems: saveRevenueItems })
                    update.form = _.assign(draft.form, { revenues: revenues })
                    resolve(update)
                })
            }).then((save) => {
                console.log(data)
                return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                    return {
                        success: true,
                        data:  save.revenueItemsReturn
                    }
                })
            })
        },

        removeRevenueItem(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    let update = {}

                    update.saveRevenueItems = _.filter(draft.form.revenues.revenueItems, (revenueItem) => {
                        return revenueItem.id !== data.form.revenueItemId
                    })

                    update.return = data.form.revenueItemId
                    
                    const revenues = _.assign(draft.form.revenues, { revenueItems: update.saveRevenueItems })
                    update.form = _.assign(draft.form, { revenues: revenues })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                    return {
                        success: true,
                        data: {
                            id: save.return
                        }
                    }
                })
            })
        },

        //


        // <-- end REVENUES

        ///////////////////////
        ///     EXPENSES    ///
        ///  ** payments    ///
        ///////////////////////
        //

        ///////////////////////
        ///     EXPENSES    ///
        ///     ** Groups   ///
        ///////////////////////
        //
        addExpenseGroup(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    let saveExpenseGroups = draft.form.expenses.expenseGroups
                    let update = {}

                    update.expenseGroupsReturn = {id: 'temp:' + shortid.generate()}
                    saveExpenseGroups.push(update.expenseGroupsReturn)

                    const expenses = _.assign(draft.form.expenses, { expenseGroups: saveExpenseGroups })
                    update.form = _.assign(draft.form, { expenses: expenses })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                    return save.expensesGroupsReturn
                })
            })

        },

        removeExpenseGroup(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    const check = _.findIndex(draft.form.expenses.expenseItems, (expenseItem) => {
                        return expenseItem.expenseGroupId === data.expenseGroupId
                    })

                    let update = {}

                    if (check !== -1) {
                        update.check = true
                        resolve(update)
                    }
                    else {
                        update.saveExpenseGroup = _.filter(draft.form.expenses.expenseGroups, (expenseGroup) => {
                            return expenseGroup.id !== data.expenseGroupId
                        })

                        const expenses = _.assign(draft.form.expenses, { expenseGroups: update.saveExpenseGroup })
                        update.form = _.assign(draft.form, { expenses: expenses })

                        resolve(update)
                    }
                })
            }).then((save) => {
                if(save.check){
                    return "Não é possivel excluir com itens"
                }
                else{
                    return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                        return save
                    })
                }
            })
        },

        // <-- end expenses GROUPS

        ///////////////////////
        ///     EXPENSES    ///
        ///     ** Itens    ///
        ///////////////////////
        //
        addExpenseItem(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    let saveExpenseItems = draft.form.expenses.expenseItems
                    let update = {}

                    let positionCheck = _.filter(draft.form.expenses.expenseItems, (expenseItem) => {
                        return expenseItem.expenseGroupId === data.form.expenseGroupId
                    })

                    const position = (positionCheck.length) ? (positionCheck.length + 1) : 1
                    
                    update.expenseItemsReturn = _.assign({id: 'temp:' + shortid.generate()}, data.form, {position: position})
                    saveExpenseItems.push(update.expenseItemsReturn)

                    const expenses = _.assign(draft.form.expenses, { expenseItems: saveExpenseItems })
                    update.form = _.assign(draft.form, { expenses: expenses })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                    return save.saveExpenseItems
                })
            })
        },

        removeExpenseItem(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    update.saveExpenseItems = _.filter(draft.form.expenses.expenseItems, (expenseItem) => {
                        return expenseItem.id !== data.expenseItemId
                    })

                    const expenses = _.assign(draft.form.expenses, { expenseItems: update.saveExpenseItems })
                    update.form = _.assign(draft.form, { expenses: expenses })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                    return save
                })
            })
        },
        // <-- end expenses ITEMS

        // <-- end expenses

        ///////////////////////
        ///     ITEMS       ///
        ///     ** move     ///
        ///////////////////////

        //
        moveUpItem(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    const itemMoveUp = _.find(draft.form[data.type][data.items], { id: data.itemId })
                    const itemMoveUpIndex = draft.form[data.type][data.items].indexOf(itemMoveUp)

                    let arrayGroup = _.filter(draft.form[data.type][data.items], (item) => {
                        return item[data.group] === draft.form[data.type][data.items][itemMoveUpIndex][data.group]
                    })

                    const itemMoveDown = ( _.findIndex(_.sortBy(arrayGroup, 'position'), { id: data.itemId }) - 1 )
                    const itemMoveDownIndex = draft.form[data.type][data.items].indexOf(arrayGroup[itemMoveDown])

                    const positionDown = itemMoveUp.position
                    const positionUp = draft.form[data.type][data.items][itemMoveDownIndex].position

                    draft.form[data.type][data.items][itemMoveDownIndex] = _.assign(arrayGroup[itemMoveDown], {position: positionDown})
                    draft.form[data.type][data.items][itemMoveUpIndex] = _.assign(itemMoveUp, {position: positionUp})    

                    let update = {}

                    update.itemsReturn = _.sortBy(draft.form[data.type][data.items], 'position')

                    const items = _.assign(draft.form[data.type], { [data.items]: draft.form[data.type][data.items] })
                    update.form = _.assign(draft.form, { [data.type]: items })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                    return {
                        success: true,
                        data: save.itemsReturn
                    }
                })
            })
        },

        moveDownItem(data) {
            return new Promise((resolve, reject) => {
                return this.getOne(data.draftId).then((draft) => {

                    const itemMoveDown = _.find(draft.form[data.type][data.items], { id: data.itemId })
                    const itemMoveDownIndex = draft.form[data.type][data.items].indexOf(itemMoveDown)

                    let arrayGroup = _.filter(draft.form[data.type][data.items], (item) => {
                        return item[data.group] === draft.form[data.type][data.items][itemMoveUpIndex][data.group]
                    })

                    const itemMoveUp = ( _.findIndex(_.sortBy(arrayGroup, 'position'), { id: data.itemId }) + 1 )
                    const itemMoveUpIndex = draft.form[data.type][data.items].indexOf(arrayGroup[itemMoveDown])

                    const positionDown = draft.form[data.type][data.items][itemMoveUpIndex].position
                    const positionUp = itemMoveDown.position

                    draft.form[data.type][data.items][itemMoveDownIndex] = _.assign(arrayGroup[itemMoveDown], {position: positionDown})
                    draft.form[data.type][data.items][itemMoveUpIndex] = _.assign(itemMoveUp, {position: positionUp}) 

                    let update = {}

                    update.itemsReturn = _.sortBy(draft.form[data.type][data.items], 'position')

                    const items = _.assign(draft.form[data.type], { [data.items]: draft.form[data.type][data.items] })
                    update.form = _.assign(draft.form, { [data.type]: items })

                    resolve(update)
                })
            }).then((save) => {
                return server.mongodb.Draft.update({ draftId: data.draftId }, { $set: { form: save.form } }).then(() => {
                    return {
                        success: true,
                        data: save.itemsReturn
                    } 
                })
            })
        },
        //

// <-- end ACCOUNTS

    } // <-- end RETURN

} // <-- end EXPORTS