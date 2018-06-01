import _ from 'lodash'
import moment from 'moment'
import Sequelize, {Op} from 'sequelize'
import EventResponse from '~server/models/EventResponse'
import config from '~config'
import { base64encode, base64decode } from 'nodejs-base64'

module.exports = (server) => { 
    //PRIVATES
    let _transaction = null
    let _saveInRequest = null

    return {
    name: "cashier-balancing",
    actions: {
        /**
         * Load the cashier-balancing list, https://stackoverflow.com/questions/207477/restful-url-design-for-search
         * @param {Object} ctx.params.data = { companyId:Number }
         * @returns {Promise.<Array>} sections
         */
        getList(ctx){

            const searchObj = {
                requestId: null,
                dateCreated: null,
                responsibleUser: null,
                clientGroup: null,
                paymentMethod: null,
                status: null,
                paid: null
            }

            if(_.get(ctx.params,'data.filter',false)){
                _.assign(searchObj,JSON.parse(base64decode(ctx.params.data.filter)))
            }

            const where = {}
            const clientWhere = {}
            const requestWhere = {}

            // set requestId

            if(_.get(searchObj,'requestId',false)){
                where.requestId = searchObj.requestId
            }

            // set payment method filter

            if(_.get(searchObj,'paymentMethod',false)){
                if(_.isArray(searchObj.paymentMethod) && searchObj.paymentMethod.length){
                    where.paymentMethodId = {
                        [Op.or]: searchObj.paymentMethod
                    }
                }
                else{
                    where.paymentMethodId = searchObj.paymentMethod
                }
            }

            // set client group filter

            if(_.get(searchObj,'clientGroup',false)){
                if(_.isArray(searchObj.clientGroup) && searchObj.clientGroup.length){
                    clientWhere.clientGroupId = {
                        [Op.or]: searchObj.clientGroup
                    }
                }
                else{
                    clientWhere.clientGroupId = searchObj.clientGroup
                }
            }

            // set created dates filter

            if(_.get(searchObj,'dateCreated',false)){
                if(_.isArray(searchObj.dateCreated) && searchObj.dateCreated.length){
                    where.dateCreated = {
                        [Op.or]: _.map(searchObj.dateCreated, (oneDateCreatedFromArray) => {
                            if(_.isArray(oneDateCreatedFromArray)){ // its a date interval
                                return {
                                    [Op.gte]: moment(_.first(oneDateCreatedFromArray)).startOf("day").toDate(),
                                    [Op.lte]: moment(_.last(oneDateCreatedFromArray)).endOf("day").toDate()
                                }
                            }
                            else {
                                return {
                                    [Op.gte]: moment(oneDateCreatedFromArray).startOf("day").toDate(),
                                    [Op.lte]: moment(oneDateCreatedFromArray).endOf("day").toDate()
                                }
                            }
                        })
                    }
                }
                else if(moment(searchObj.dateCreated).isValid()) {
                    where.dateCreated = {
                        [Op.gte]: moment(searchObj.dateCreated).startOf("day").toDate(),
                        [Op.lte]: moment(searchObj.dateCreated).endOf("day").toDate()
                    }
                }
            }

            // set paid filter
            if(_.get(searchObj,'paid',false)){
                where.paid = {
                    [Op.eq]: searchObj.paid
                }
            }

            // set resposible users filter

            if(_.get(searchObj,'responsibleUser',false)){
                if(_.isArray(searchObj.responsibleUser) && searchObj.responsibleUser.length){
                    requestWhere.userId = {
                        [Op.or]: searchObj.responsibleUser
                    }
                }
                else{
                    requestWhere.userId = searchObj.responsibleUser
                }
            }

            // set status filter

            if(_.get(searchObj,'status',false)){
                if(_.isArray(searchObj.status) && searchObj.status.length){
                    requestWhere.status = {
                        [Op.or]: searchObj.status
                    }
                }
                else{
                    requestWhere.status = searchObj.status
                }
            }

            const promises = []

            promises.push(server.mysql.RequestPaymentMethod.findAndCountAll({
                where,
                include: [
                    {
                        model: server.mysql.Request,
                        as: 'request',
                        include: [
                            {
                                model: server.mysql.Client,
                                as: 'client',
                                include: [
                                    {
                                        model: server.mysql.ClientGroup,
                                        as: 'clientGroup'
                                    }
                                ],
                                where: clientWhere
                            }
                        ],
                        where: {
                            companyId: parseInt(ctx.params.data.companyId),
                            ...requestWhere
                        }
                    },
                    {
                        model: server.mysql.PaymentMethod,
                        as: 'paymentMethod'
                    },
                    {
                        model: server.mysql.RequestPaymentTransaction,
                        as: 'requestPaymentTransactions',
                        include: [{
                            model: server.mysql.Transaction,
                            as: 'transaction'
                        }]
                    }
                ],
                distinct: 'id',
                order: [
                    ['id', 'ASC'],
                ],
                limit: parseInt(ctx.params.data.limit),
                offset: parseInt(ctx.params.data.offset),
            }))

            promises.push(server.mysql.RequestPaymentMethod.sum('amount', {
                where,
                include: [
                    {
                        model: server.mysql.Request,
                        as: 'request',
                        include: [
                            {
                                model: server.mysql.Client,
                                as: 'client',
                                where: clientWhere
                            }
                        ],
                        where: {
                            companyId: parseInt(ctx.params.data.companyId),
                            ...requestWhere
                        }
                    }
                ]
            }))



            return Promise.all(promises).then(([list, totalAmount]) => {
                return {
                    list,
                    totalAmount: totalAmount || 0
                }
            })

        },
        markAsPaid(ctx){
            this._transaction = ctx.params.transaction || null

            return ctx.call("cashier-balancing.setTransaction").then(() => {
                return server.mysql.RequestPaymentMethod.findAll({
                    where: {
                        id: {
                            [Op.in]: ctx.params.data.requestPaymentIds
                        },
                        paid: (ctx.params.persistence) ? true : false
                    },
                    include: [
                        {
                            model: server.mysql.Request,
                            as: 'request',
                            where: {
                                companyId: {
                                    [Op.in]: [ctx.params.data.companyId]
                                }
                            },
                            include: [{
                                model: server.mysql.User,
                                as: "responsibleUser"
                            }]
                        }
                    ],
                    transaction: this._transaction
                }).then((requestPaymentMethods) => {
                    const accountBalances = {}
                    const promises = _.map(requestPaymentMethods, (requestPaymentMethod) => {
                        return ctx.call('data/transaction.create', {
                            data: {
                                amount: Math.abs(requestPaymentMethod.amount),
                                createdById: ctx.params.data.createdById,
                                accountId: (ctx.params.data.accountId) ? ctx.params.data.accountId : requestPaymentMethod.request.responsibleUser.accountId,
                                companyId: requestPaymentMethod.request.companyId,
                                description: 'Adição do valor do pagamento do pedido #' + requestPaymentMethod.request.id + ' na conta de destino',
                            },
                            transaction: this._transaction
                        }).then((transaction) => {
                            return server.mysql.Account.findById(transaction.accountId, {
                                transaction: this._transaction
                            }).then((account) => {
                                if(!accountBalances[account.id]) accountBalances[account.id] = account.balance
                                accountBalances[account.id] = parseFloat(accountBalances[account.id]) + parseFloat(transaction.amount)
                                return server.mysql.RequestPaymentTransaction.create({
                                    requestPaymentId: requestPaymentMethod.id,
                                    transactionId: transaction.id,
                                    settledDatetime: null,
                                    action: 'payment'
                                    }, {
                                    transaction: this._transaction
                                }).then(() => {
                                    return requestPaymentMethod.update({
                                        paid: true,
                                        paidDatetime: moment(),
                                    },{
                                        returning: true,
                                        plain: true,
                                        transaction: this._transaction
                                    })
                                })                            
                            })
                        })
                    })
                    return Promise.all(promises).then(() => {
                        const updateAccountBalancesPromise = []
                        _.forEach(_.keys(accountBalances),(accountId) => {
                            updateAccountBalancesPromise.push(server.mysql.Account.update({
                                balance: accountBalances[accountId]
                                }, {
                                where: {
                                    id: parseInt(accountId)
                                },
                                transaction: this._transaction
                            }))
                        })
                        return Promise.all(updateAccountBalancesPromise).then(() => {
                            if(this._saveInRequest) {
                                return true
                            }
                            else {
                                return ctx.call("cashier-balancing.commit")
                            }
                        }).catch(() => {
                            console.log("Erro em: cashier-balancing.markAsPaid")
                            if(this._saveInRequest) {
                                return new Error("Error in markAsPaid")
                            }
                            else {
                                return ctx.call("cashier-balancing.rollback")
                            }
                        })
                    })
                })
            })
        },
        markAsSettled(ctx){
            this._transaction = ctx.params.transaction || null

            return ctx.call("cashier-balancing.setTransaction").then(() => {
                return server.mysql.RequestPaymentMethod.findAll({
                    include: [
                        {
                            model: server.mysql.Request,
                            as: 'request',
                            include: [
                                {
                                    model: server.mysql.User,
                                    as: 'responsibleUser'
                                }
                            ],
                            where: {
                                companyId: {
                                    [Op.in]: [ctx.params.data.companyId]
                                }
                            }
                        },
                        {
                            model: server.mysql.RequestPaymentTransaction,
                            as: 'requestPaymentTransactions'
                        }
                    ],
                    where: {
                        id: {
                            [Op.in]: ctx.params.data.requestPaymentIds
                        }
                    },
                    transaction: this._transaction
                }).then((requestPaymentMethods) => {
                    let requestPaymentsToMarkAsSettled = _.filter(requestPaymentMethods, (requestPaymentMethod) => {
                        requestPaymentMethod.requestPaymentTransactions.sort(function(a, b) { return new Date(a.dateCreated) - new Date(b.dateCreated) })
                        if(!requestPaymentMethod.requestPaymentTransactions.length){
                            return true
                        }
                        return _.last(requestPaymentMethod.requestPaymentTransactions).action !== 'settle.origin' && _.last(requestPaymentMethod.requestPaymentTransactions) !== 'settle.destination'
                    })

                    const transactionPromises = []
                    const accountBalances = {}

                    _.forEach(requestPaymentsToMarkAsSettled, (requestPaymentToMarkAsSettled) => {
                        const iterationPromises = []
                        iterationPromises.push(ctx.call('data/transaction.create', {
                            data: {
                                amount: Math.abs(requestPaymentToMarkAsSettled.amount),
                                createdById: ctx.params.data.createdById,
                                accountId: ctx.params.data.accountId,
                                companyId: ctx.params.data.companyId,
                                description: 'Adição do valor do acerto de contas na conta de destino',
                            },
                            transaction: this._transaction
                        }).then((transaction) => {
                            return server.mysql.Account.findById(ctx.params.data.accountId, {
                                transaction: this._transaction
                            }).then((account) => {
                                if(!accountBalances[account.id]) accountBalances[account.id] = account.balance
                                accountBalances[account.id] = parseFloat(accountBalances[account.id]) + parseFloat(transaction.amount)
                                return server.mysql.RequestPaymentTransaction.create({
                                    requestPaymentId: requestPaymentToMarkAsSettled.id,
                                    transactionId: transaction.id,
                                    settledDatetime: ctx.params.data.settledDatetime || new Date(),
                                    action: 'settle.destination'
                                },{
                                    transaction: this._transaction
                                })
                            })
                        }))
                        iterationPromises.push(ctx.call('data/transaction.create', {
                            data: {
                                amount: -Math.abs(requestPaymentToMarkAsSettled.amount),
                                createdById: ctx.params.data.createdById,
                                accountId: requestPaymentToMarkAsSettled.request.responsibleUser.accountId,
                                companyId: ctx.params.data.companyId,
                                description: 'Redução do valor do acerto de contas na conta de origem',
                            },
                            transaction: this._transaction
                        }).then((transaction) => {
                            return server.mysql.Account.findById(requestPaymentToMarkAsSettled.request.responsibleUser.accountId, {
                                transaction: this._transaction
                            }).then((account) => {
                                if(!accountBalances[account.id]) accountBalances[account.id] = account.balance
                                accountBalances[account.id] = parseFloat(accountBalances[account.id]) + parseFloat(transaction.amount)
                                    return server.mysql.RequestPaymentTransaction.create({
                                        requestPaymentId: requestPaymentToMarkAsSettled.id,
                                        transactionId: transaction.id,
                                        settledDatetime: ctx.params.data.settledDatetime || new Date(),
                                        action: 'settle.origin'
                                    }, {
                                    transaction: this._transaction
                                })
                            })
                        }))
                        transactionPromises.push(
                            Promise.all(iterationPromises)
                        )
                    })

                    return Promise.all(transactionPromises).then((res) => {
                        const updateAccountBalancesPromise = []
                        _.forEach(_.keys(accountBalances),(accountId) => {
                            updateAccountBalancesPromise.push(server.mysql.Account.update({
                                balance: accountBalances[accountId]
                            }, {
                                where: {
                                    id: parseInt(accountId)
                                },
                                transaction: this._transaction
                            }))
                        })
                        return Promise.all(updateAccountBalancesPromise).then(() => {
                            if(this._saveInRequest) {
                                return true
                            }
                            else {
                                return ctx.call("cashier-balancing.commit")
                            }
                        }).catch(() => {
                            console.log("Erro em: cashier-balancing.markAsSettled")
                            if(this._saveInRequest) {
                                return new Error("Error in markAsSettled")
                            }
                            else {
                                return ctx.call("cashier-balancing.rollback")
                            }
                        })
                    })
                })
            })
        },

        revertTransaction(ctx){
            return ctx.call('data/transaction.create', {
                data: ctx.params.data,
                transaction: ctx.params.transaction
            }).then((transaction) => {
                return server.mysql.Account.findById(transaction.accountId, {
                    transaction: ctx.params.transaction
                }).then((account) => {
                    account.balance = parseFloat(account.balance) - parseFloat(transaction.amount)
                    return account.save({transaction: ctx.params.transaction})
                })
            })

        },

        /**
         * @returns {Promise} set transaction
         */ 
        setTransaction() {
            if(!this._transaction){
                return server.sequelize.transaction().then((transaction) => {
                    this._transaction = transaction
                    this._saveInRequest = false
                })
            }
            else {
                this._saveInRequest = true
                return true
            }
        },

        /**
         * Commit persistence
         */
        commit() {
            console.log("Commit Balance changes!")
            this._transaction.commit()
        },

        /**
         * Rollback persistence
         */
        rollback() {
            console.log("Oh God, just rollback!")
            this._transaction.rollback()
            throw new Error()
        }
    }
}}