const Draft = require('.')
const basePath = require('../../middlewares/base-path.middleware')
const _ = require('lodash')
const RequestPersistance = require('../../modules/Draft/Persistance/RequestPersistance');
const ClientPersistance = require('../../modules/Draft/Persistance/ClientPersistance');
const OrderPersistance = require('../../modules/Draft/Persistance/OrderPersistance');
const RequestRecoverance = require('../../modules/Draft/Recoverance/RequestRecoverance');

module.exports = class Request extends Draft {

    constructor(server, channels, socket) {
        // extends
        super(server, channels, socket);
        // private
        this._requestPersistance = new RequestPersistance(server);
        this._clientPersistance = new ClientPersistance(server);
        this._orderPersistance = new OrderPersistance(server);
        this._requestRecoverance = new RequestRecoverance(server);        
        // functions
        this.setRequestEventListeners();
    }

    /**
     * Events on Request Listeners
     * 
     */
    setRequestEventListeners() {

    this.socket.on('draft:request-persist', (requestPersist) => {
        super.resetTimeout()
        super.saveDraft(requestPersist.draftId).then(() => {
            this.onRequestPersist(requestPersist)
        })
    })
     
        ///////////////////////
        ///     CLIENT      ///
        ///////////////////////
    //
        this.socket.on('draft:client-select', (clientSelect) => {
            super.resetTimeout()
            super.saveDraft(clientSelect.draftId).then(() => {
                this.onClientSelect(clientSelect)
            })
        })

        this.socket.on('draft:client-reset', (clientReset) => {
            super.resetTimeout()
            super.saveDraft(clientReset.draftId).then(() => {
                this.onClientReset(clientReset)
            })
        })

        this.socket.on('draft:client-persist', (clientPersist) => {
            super.resetTimeout()
            super.saveDraft(clientPersist.draftId).then(() => {
                this.onClientPersist(clientPersist)
            })
        })

            ///////////////////////
            ///     CLIENT      ///
            ///  ** address     ///
            ///////////////////////
        //
            this.socket.on('draft:client-address-add', (clientAddressAdd) => {
                super.resetTimeout()
                super.saveDraft(clientAddressAdd.draftId).then(() => {
                    this.onClientAddressAdd(clientAddressAdd)
                })
            })

            this.socket.on('draft:client-address-edit', (clientAddressEdit) => {
                super.resetTimeout()
                super.saveDraft(clientAddressEdit.draftId).then(() => {
                    this.onClientAddressEdit(clientAddressEdit)
                })
            })

            this.socket.on('draft:client-address-back', (clientAddressBack) => {
                super.resetTimeout()
                super.saveDraft(clientAddressBack.draftId).then(() => {
                    this.onClientAddressBack(clientAddressBack)
                })
            })

            this.socket.on('draft:client-address-update', (clientAddressUpdate) => {
                super.resetTimeout()
                this.onClientAddressUpdate(clientAddressUpdate)
            })

            this.socket.on('draft:client-address-save', (clientAddressSave) => {
                super.resetTimeout()
                super.saveDraft(clientAddressSave.draftId).then(() => {
                    this.onClientAddressSave(clientAddressSave)
                })
            })

            this.socket.on('draft:client-address-remove', (clientAddressRemove) => {
                this.onClientAddressRemove(clientAddressRemove)
            })

                ///////////////////////////////
                //CLIENT ADDRESS => ADDRESS  //
                ///////////////////////////////
            //
                this.socket.on('draft:client-address-address-select', (clientAddressAddressSelect) => {
                    super.resetTimeout()
                    super.saveDraft(clientAddressAddressSelect.draftId).then(() => {
                        this.onClientAddressAddressSelect(clientAddressAddressSelect)
                    })
                })

                this.socket.on('draft:client-address-address-reset', (clientAddressAddressReset) => {
                    super.resetTimeout()
                    super.saveDraft(clientAddressAddressReset.draftId).then(() => {
                        this.onClientAddressAddressReset(clientAddressAddressReset)
                    })
                })
            //
        // <-- end CLIENT ** address | setSocketRequestListeners

            //////////////////////
            ///     CLIENT     ///
            ///  ** phone      ///
            //////////////////////
        //
            this.socket.on('draft:client-phone-edit', (clientPhoneEdit) => {
                this.onClientPhoneEdit(clientPhoneEdit)
            })

            this.socket.on('draft:client-phone-edition-cancel', (clientPhoneEditionCancel) => {
                super.resetTimeout()
                super.saveDraft(clientPhoneEditionCancel.draftId).then(() => {
                    this.onClientPhoneEditionCancel(clientPhoneEditionCancel)
                })
            })

            this.socket.on('draft:client-phone-save', (clientPhoneSave) => {
                super.resetTimeout()
                super.saveDraft(clientPhoneSave.draftId).then(() => {
                    this.onClientPhoneSave(clientPhoneSave)
                })
            })

            this.socket.on('draft:client-phone-update', (clientPhoneUpdate) => {
                super.resetTimeout()
                this.onClientPhoneUpdate(clientPhoneUpdate)
            })

            this.socket.on('draft:client-phone-remove', (clientPhoneRemove) => {
                this.onClientPhoneRemove(clientPhoneRemove)
            })
        // <-- end CLIENT ** phone | setSocketRequestListeners

            /////////////////////////
            ///     CLIENT        ///
            /// ** custom-field   ///
            /////////////////////////
        //
            this.socket.on('draft:client-custom-field-add', (clientCustomFieldAdd) => {
                super.saveDraft(clientCustomFieldAdd.draftId).then(() => {
                    this.onClientCustomFieldAdd(clientCustomFieldAdd)
                })
            })

            this.socket.on('draft:client-custom-field-update', (clientCustomFieldUpdate) => {
                super.resetTimeout()
                this.onClientCustomFieldUpdate(clientCustomFieldUpdate)
            })

            this.socket.on('draft:client-custom-field-remove', (clientCustomFieldRemove) => {
                super.saveDraft(clientCustomFieldRemove.draftId).then(() => {
                    this.onClientCustomFieldRemove(clientCustomFieldRemove)
                })
            })
        // <-- end CLIENT ** custom-field  | setSocketRequestListeners

             ///////////////////////
            ///  CUSTOM FIELD   ///
            /// ** in company   ///
            ///////////////////////
        //
        this.socket.on('draft:custom-field-save', (customFieldSave) => {
            super.saveDraft(customFieldSave.draftId).then(() => {
                this.onDraftCustomFieldSave(customFieldSave)
            })
        })

        this.socket.on('draft:custom-field-remove', (customFieldRemove) => {
            super.saveDraft(customFieldRemove.draftId).then(() => {
                this.onDraftCustomFieldRemove(customFieldRemove)
            })
        })
    

                ///////////////////////
                ///  Client Group   ///
                /// ** in company   ///
                ///////////////////////
        //
            this.socket.on('draft:client-group-save', (clientGroupSave) => {
                super.saveDraft(clientGroupSave.draftId).then(() => {
                    this.onDraftClientGroupSave(clientGroupSave)
                })
            })

            this.socket.on('draft:client-group-remove', (clientGroupRemove) => {
                super.saveDraft(clientGroupSave.draftId).then(() => {
                    this.onDraftClientGroupRemove(clientGroupSave)
                })
            })
        // <-- end Client Group | setSocketRequestListeners

    // <-- end CLIENT | setSocketRequestListeners

        ///////////////////////
        ///     ORDER       ///
        ///////////////////////
//


    this.socket.on('draft:order-user-in-charge', (orderUserInCharge) => {
        super.resetTimeout()
        super.saveDraft(orderUserInCharge.draftId).then(() => {
            this.onOrderUserInCharge(orderUserInCharge)
        })
    })

            ///////////////////////
            ///     ORDER      ///
            ///  ** product     ///
            ///////////////////////
    //
        this.socket.on('draft:order-product-add', (orderProductAdd) => {
            super.resetTimeout()
            super.saveDraft(orderProductAdd.draftId).then(() => {
                this.onOrderProductAdd(orderProductAdd)
            })
        })

        this.socket.on('draft:order-product-remove', (orderProductRemove) => {
            super.resetTimeout()
            super.saveDraft(orderProductRemove.draftId).then(() => {
                this.onOrderProductRemove(orderProductRemove)
            })
        })

        this.socket.on('draft:order-product-product-select', (orderProductSelect) => {
            super.resetTimeout()
            super.saveDraft(orderProductSelect.draftId).then(() => {
                this.onOrderProductProductSelect(orderProductSelect)
            })
        })

        this.socket.on('draft:order-product-product-reset', (orderProductReset) => {
            super.resetTimeout()
            super.saveDraft(orderProductReset.draftId).then(() => {
                this.onOrderProductProductReset(orderProductReset)
            })
        })

    //<-- end ORDER ** product | setSocketRequestListeners

//<-- end ORDER | setSocketRequestListeners

    } // <-- end setSocketRequestListeners


    /**
     * Request Persist
     * @desc Send to all sockets in Draft/:id the persist client event
     *
     * @param {object} requestPersist - expected: draftId
     * @return {} @property {Socket}
     */
    onRequestPersist(requestPersist) {
        let companyId;
        if(this.socket.user.activeCompanyUserId){
            companyId = parseInt(this.socket.user.activeCompanyUserId);
        }
        else {
            if(this.socket.user.companies.length) companyId = _.first(this.socket.user.companies)
        }
        if(companyId){
            this._clientPersistance.setSaveInRequest(true)

            this._clientPersistance.setDraftId(requestPersist.draftId)
            this._clientPersistance.setCompanyId(companyId)

            //this.server.io.in('draft/' + requestPersist.draftId).emit('draftRequestPersist', 'Started saving request')

            this._requestPersistance.setTransaction().then((transaction) => {
                //this.server.io.in('draft/' + requestPersist.draftId).emit('draftRequestPersist', 'saving the client')
                this._clientPersistance.start(transaction).then((client) => {
                    //this.server.io.in('draft/' + requestPersist.draftId).emit('draftRequestPersist', (client) ? 'client saved, id: ' + client.clientId : 'client set as Null' )
                    this._orderPersistance.setDraftId(requestPersist.draftId)
                    this._orderPersistance.setSaveInRequest(true)

                    this._orderPersistance.setCompanyId(companyId)

                    //this.server.io.in('draft/' + requestPersist.draftId).emit('draftRequestPersist', 'saving the order')
                    this._orderPersistance.start(transaction).then((order) => {
                        //this.server.io.in('draft/' + requestPersist.draftId).emit('draftRequestPersist', 'order saved, id: ' + order.orderId)

                        this._requestPersistance.setDraftId(requestPersist.draftId)
                        this._requestPersistance.setCompanyId(companyId)
                        this._requestPersistance.setUserId(this.socket.user.id)                        

                        if(client){
                            this._requestPersistance.setClient(client)
                            this._requestPersistance.setClientId(client.id)
                        }
                        else{
                            this._requestPersistance.setClient()
                            this._requestPersistance.setClientId()
                        }
                        if(order){
                            this._requestPersistance.setOrderId(order.id) 
                        }
                        else{
                            this._requestPersistance.setOrderId() 
                        }

                        const task = null
                        if(task){
                            this._requestPersistance.setTaskId(task.taskId) 
                        }
                        else{
                            this._requestPersistance.setTaskId()
                        }

                        //this.server.io.in('draft/' + requestPersist.draftId).emit('draftRequestPersist', 'saving the request')
                        this._requestPersistance.start().then((request) => {
                            this.server.io.in('draft/' + requestPersist.draftId).emit('draftRequestPersist', 'request saved, id: ' + request.id)
                        }).catch((err) => {
                            console.log('ERRO: START DO REQUEST PERSISTANCE: ', err)
                        })
                    }).catch((err) => {
                        console.log('ERRO: START DO ORDER PERSISTANCE: ', err)
                    })                      
                }).catch((err) => {
                    this._requestPersistance.rollback().then(() => {
                        this.server.io.in('draft/' + requestPersist.draftId).emit('draftClientPersist', 'error in saving client')
                    })
                })
            }).catch((err) => {
                console.log('ERRO: SET TRANSACTION: ', err)
            })   
        }
    }

    ///////////////////////
    ///     CLIENT      ///
    ///////////////////////
//
    /** 
     * Client Select
     * @desc Send to all sockets in Draft/:id the select client event
     * 
     * @param {object} clientSelect - expected: draftId, clientId
     * @return {object} Client @property {Socket}
     */
    onClientSelect(clientSelect) {
        clientSelect.clientAddress = { inEdition: false }
        clientSelect.clientPhone = { inEdition: false }
        super.setDraftRedis(clientSelect, true).then(() => {
            this.controller.selectClient(clientSelect).then((client) => {
                this.server.io.in('draft/' + clientSelect.draftId).emit('draftClientAddressBack')
                this.server.io.in('draft/' + clientSelect.draftId).emit('draftClientSelect', client)
            }).catch(() => {
                console.log('catch do SELECT CLIENT - QUE É DENTRO DO ON CLIENT SELECT')
            })
        }).catch((err) => {
            console.log('catch do SET DRAFT REDIS - QUE É DENTRO DO ON CLIENT SELECT', err)
        })
    }

    /** 
     * Client Reset
     * @desc Send to all sockets in Draft/:id the reset client event
     * 
     * @param {object} clientReset - expected: draftId
     * @return {} @property {Socket}
     */
    onClientReset(clientReset) {
        clientReset.clientAddress = { inEdition: true, clientAddressId: null }
        clientReset.clientPhone = { inEdition: true, clientPhoneId: null }
        
        super.setDraftRedis(clientReset).then(() => {
            this.controller.resetClient(clientReset).then(() => {
                this.server.io.in('draft/' + clientReset.draftId).emit('draftClientAddressAdd')
                //this.server.io.in('draft/' + clientReset.draftId).emit('draftClientAddressAddressReset')
                this.server.io.in('draft/' + clientReset.draftId).emit('draftClientPhoneEditionCancel')
                this.server.io.in('draft/' + clientReset.draftId).emit('draftClientReset')
            }).catch(() => {
                console.log('catch do RESET CLIENT - QUE É DENTRO DO ON CLIENT RESET')
            })
        }).catch((err) => {
            console.log('catch do SET DRAFT REDIS - QUE É DENTRO DO ON CLIENT RESET', err)
        })
    }

    /**
     * Client Persist
     * @desc Send to all sockets in Draft/:id the persist client event
     *
     * @param {object} clientPersist - expected: draftId
     * @return {} @property {Socket}
     */
    onClientPersist(clientPersist) {
        let companyId;
        if(this.socket.user.activeCompanyUserId){
            companyId = parseInt(this.socket.user.activeCompanyUserId);
        }
        else {
            if(this.socket.user.companies.length) companyId = _.first(this.socket.user.companies)
        }
        if(companyId){
            this._clientPersistance.setDraftId(clientPersist.draftId);
            this._clientPersistance.setCompanyId(companyId);
            this._clientPersistance.start().then((draft) => {
                
                this.server.io.in('draft/' + clientPersist.draftId).emit('draftClientPersist', draft)
            }).catch((err) => {
                console.log("ERROR", err);
            });
        }
    }

        ///////////////////////
        ///     CLIENT      ///
        ///  ** address     ///
        ///////////////////////
    //
        /**
         * Client Address Add
         * @desc Send to all sockets in Draft/:id the add form event
         * 
         * @param {object} clientAddressAdd - expected: draftId
         * @return {} @property {Socket}
         */
        onClientAddressAdd(clientAddressAdd) {
            clientAddressAdd.inEdition = { clientAddress: { inEdition: true, clientAddressId: null } }
            super.updateDraftRedis(clientAddressAdd, true).then(() => {
                this.server.io.in('draft/' + clientAddressAdd.draftId).emit('draftClientAddressAdd')
            })
        }

        /**
         * Client Address Edit
         * @desc Send to all sockets in Draft/:id the edit form event
         * 
         * @param {object} clientAddressEdit - expected: draftId, clientAddressId
         * @return {int} ClientAddress @property {Socket}
         */
        onClientAddressEdit(clientAddressEdit) {
            clientAddressEdit.inEdition = { clientAddress: { inEdition: true, clientAddressId: clientAddressEdit.clientAddressId } }
            super.updateDraftRedis(clientAddressEdit, true).then(() => {
                this.controller.clientAddressEdit(clientAddressEdit).then(() => {
                    this.server.io.in('draft/' + clientAddressEdit.draftId).emit('draftClientAddressEdit', clientAddressEdit.clientAddressId)
                })
            })
        }

        /**
         * Client Address Back
         * @desc Send to all sockets in Draft/:id the back 'main' form event
         * 
         * @param {object} clientAddressBack - expected: draftId, clientAddressId
         * @return {} @property {Socket}
         */
        onClientAddressBack(clientAddressBack) {
            clientAddressBack.clientAddressForm = true
            clientAddressBack.inEdition = { clientAddress: { inEdition: false, clientAddressId: null } }
            super.updateDraftRedis(clientAddressBack, true).then(() => {
                delete clientAddressBack.clientAddressForm
                this.controller.clientAddressBack(clientAddressBack).then(() => {
                    this.server.io.in('draft/' + clientAddressBack.draftId).emit('draftClientAddressBack')
                })
            })
        }

        /**
         * Client Address Update
         * @desc Send to all sockets in Draft/:id the updating data in client address form
         * 
         * @param {object} clientAddressUpdate - expected: draftId, clientAddressForm, ? clientAddressId
         * @return {} @property {Socket}
         */
        onClientAddressUpdate(clientAddressUpdate) {
            this.socket.broadcast.in('draft/' + clientAddressUpdate.draftId).emit('draftClientAddressUpdate', clientAddressUpdate.clientAddressForm)

            clientAddressUpdate.form = { clientAddressForm: clientAddressUpdate.clientAddressForm }
            clientAddressUpdate.form.clientAddressForm.id = (clientAddressUpdate.clientAddressId) ? clientAddressUpdate.clientAddressId : null
            delete clientAddressUpdate.clientAddressId

            //clientAddressUpdate.clientAddressForm = true
            super.updateDraftRedis(clientAddressUpdate).then(() => {
                delete clientAddressUpdate.clientAddressForm
                super.setArrayDraft(clientAddressUpdate).then(() => {
                    this.server.io.in('draft/' + clientAddressUpdate.draftId).emit('draftClientAddressSaveable')
                    super.timerSocketUpdate(clientAddressUpdate.draftId)
                })
            }).catch(() => {
                console.log('catch do SET ARRAY DENTRO DO onClientAddressUpdate - chamado pelo SUPER')
            })
        }

        /**
         * Client Address Save
         * @desc Send to all sockets in Draft/:id the client address saved
         * 
         * @param {object} addressSave - expected: draftId
         * @return {object} client address @property {Socket}
         */
        onClientAddressSave(clientAddressSave) {
            this.controller.saveClientAddress(clientAddressSave).then((savedClientAddress) => {

                clientAddressSave.clientAddressForm = false
                clientAddressSave.clientPhoneForm = false
                clientAddressSave.inEdition = { clientAddress: { inEdition: false, clientAddressId: null } }
                super.updateDraftRedis(clientAddressSave).then(() => {
                    this.server.io.in('draft/' + clientAddressSave.draftId).emit('draftClientAddressSave', savedClientAddress)
                })
            }).catch((err) => {
                console.log(err, 'catch do SAVE ADDRESS CLIENT - QUE É DENTRO DO ON CLIENT ADDRESS ADDRESS SAVE')
            })
        }

        /**
         * Client Address Remove
         * @desc Send to all sockets in Draft/:id the address saved
         * 
         * @param {object} clientAddressRemove - expected: draftId, clientAddressId
         * @return {int} client address Id  @property {Socket}
         */
        onClientAddressRemove(clientAddressRemove) {
            this.controller.removeClientAddress(clientAddressRemove).then((removedClientAddress) => {
                if (removedClientAddress.form.client.clientAddresses.length < 1) {
                    clientAddressRemove.inEdition = { clientAddress: { inEdition: true, clientAddressId: null } }
                    super.updateDraftRedis(clientAddressRemove).then(() => {
                        this.server.io.in('draft/' + clientAddressRemove.draftId).emit('draftClientAddressAdd')
                    })
                }
                this.server.io.in('draft/' + clientAddressRemove.draftId).emit('draftClientAddressRemove', removedClientAddress.clientAddressId)
            }).catch(() => {
                console.log('catch do REMOVE CLIENT ADDRESS - QUE É DENTRO DO ON ClientAddressRemove')
            })
        }

        ///////////////////////////////
        //CLIENT ADDRESS => ADDRESS  //
        ///////////////////////////////
        //
            /**
             * Address Select
             * @desc Send to all sockets in Draft/:id that an address has been selected
             * 
             * @param {object} addressSelect - expected: draftId, addressId
             * @return {object} address @property {Socket}
             */
            onClientAddressAddressSelect(addressSelect) {
                this.controller.selectAddressClientAddress(addressSelect).then((address) => {
                    addressSelect.address = address
                    addressSelect.inEdition = { clientAddress: { inEdition: true, clientAddressId: (addressSelect.clientAddressId) ? addressSelect.clientAddressId : null } }
                    super.updateDraftRedis(addressSelect, false, true).then(() => {
                        this.server.io.in('draft/' + addressSelect.draftId).emit('draftClientAddressAddressSelect', address)
                    })
                }).catch(() => {
                    console.log('catch do SELECT ADDRESS CLIENT - QUE É DENTRO DO ON CLIENT ADDRESS ADDDRESS SELECT')
                })
            }

            /**
             * Address Reset
             * @desc Send to all sockets in Draft/:id that an address has been reset
             * 
             * @param {object} addressReset - expected: draftId
             * @return {} @property {Socket}
             */
            onClientAddressAddressReset(addressReset) {
                super.updateDraftRedis(addressReset, false, { reset: true }).then(() => {
                    this.controller.resetAddressClientAddress(addressReset).then(() => {
                        this.server.io.in('draft/' + addressReset.draftId).emit('draftClientAddressAddressReset')
                    })
                }).catch(() => {
                    console.log('catch do RESET ADDRESS CLIENT - QUE É DENTRO DO ON CLIENT ADDRESS ADDRESS RESET')
                })
            }
        //
    // <-- end CLIENT ** address
        ///////////////////////
        ///     CLIENT      ///
        ///  ** phone       ///
        ///////////////////////
    //    
        /** 
         * Client Phone Edit
         * @desc Send to all sockets in Draft/:id the client phone edit event
         * 
         * @param {object} clientPhoneEdit - expected: draftId, clientPhoneId
         * @return {int} client phone id @property {Socket}
         */
        onClientPhoneEdit(clientPhoneEdit) {
            clientPhoneEdit.inEdition = { clientPhone: { inEdition: true, clientPhoneId: clientPhoneEdit.clientPhoneId } }
            clientPhoneEdit.clientPhoneForm = { reset: true }

            super.updateDraftRedis(clientPhoneEdit, true).then(() => {
                this.server.io.in('draft/' + clientPhoneEdit.draftId).emit('draftClientPhoneEdit', clientPhoneEdit.clientPhoneId)
            })
        }

        /** 
         * Client Phone Edition Cancel
         * @desc Send to all sockets in Draft/:id the client phone cancel event
         * 
         * @param {object} clientPhoneEditionCancel - expected: draftId
         * @return {} @property {Socket}
         */
        onClientPhoneEditionCancel(clientPhoneEditionCancel) {
            clientPhoneEditionCancel.inEdition = { clientPhone: { inEdition: false, clientPhoneId: null } }
            clientPhoneEditionCancel.clientPhoneForm = { reset: true }
            super.updateDraftRedis(clientPhoneEditionCancel).then(() => {
                this.controller.phoneEditionCancel(clientPhoneEditionCancel).then(() => {
                    this.server.io.in('draft/' + clientPhoneEditionCancel.draftId).emit('draftClientPhoneEditionCancel')
                })
            })
        }

        /** 
         * Client Phone Save
         * @desc Send to all sockets in Draft/:id the client phone save event
         * 
         * @param {object} clientPhoneSave - expected: draftId, clientPhoneId
         * @return {object} client phone  @property {Socket}
         */
        onClientPhoneSave(clientPhoneSave) {
            clientPhoneSave.inEdition = { clientPhone: { inEdition: false, clientPhoneId: null } }
            clientPhoneSave.clientPhoneForm = { reset: true }
            super.updateDraftRedis(clientPhoneSave).then(() => {
                this.controller.saveClientPhone(clientPhoneSave).then((savedClientPhone) => {
                    this.server.io.in('draft/' + clientPhoneSave.draftId).emit('draftClientPhoneSave', savedClientPhone)
                }).catch((err) => {
                    console.log(err, 'catch do SAVE PHONE CLIENT - QUE É DENTRO DO ON CLIENT PHONE ADDRESS SAVE')
                })
            })
        }

        /** 
         * Client Phone Update
         * @desc Send to all sockets in Draft/:id the client phone updating event
         * 
         * @param {object} clientPhoneUpdate - expected: draftId, clientPhoneId, clientPhoneForm
         * @return {} @property {Socket}
         */
        onClientPhoneUpdate(clientPhoneUpdate) {
            this.socket.broadcast.in('draft/' + clientPhoneUpdate.draftId).emit('draftClientPhoneUpdate', clientPhoneUpdate.clientPhoneForm)

            clientPhoneUpdate.form = { clientPhoneForm: clientPhoneUpdate.clientPhoneForm }
            clientPhoneUpdate.form.clientPhoneForm.id = (clientPhoneUpdate.clientPhoneId) ? clientPhoneUpdate.clientPhoneId : null

            clientPhoneUpdate.inEdition = { clientPhone: { inEdition: true, clientPhoneId: (clientPhoneUpdate.clientPhoneId) ? clientPhoneUpdate.clientPhoneId : null } }

            delete clientPhoneUpdate.clientPhoneId

            super.updateDraftRedis(clientPhoneUpdate).then(() => {
                delete clientPhoneUpdate.clientPhoneForm
                super.setArrayDraft(clientPhoneUpdate).then(() => {
                    this.server.io.in('draft/' + clientPhoneUpdate.draftId).emit('draftClientPhoneSaveable')
                    super.timerSocketUpdate(clientPhoneUpdate.draftId)
                }).catch(() => {
                    console.log('catch do SET ARRAY DENTRO DO onClientPhoneUpdate - chamado pelo SUPER')
                })
            })
        }

        /** 
         * Client Phone Remove
         * @desc Send to all sockets in Draft/:id the client phone remove event
         * 
         * @param {object} clientPhoneRemove - expected: draftId, clientPhoneId
         * @return {int} client phone id @property {Socket}
         */
        onClientPhoneRemove(clientPhoneRemove) {
            super.consultRedisDraft(clientPhoneRemove.draftId).then((consultRedisDraft) => {
                consultRedisDraft = JSON.parse(consultRedisDraft.clientFormEdition)

                let addTabPhone = {}
                if (consultRedisDraft.clientPhone.inEdition && consultRedisDraft.clientPhone.clientPhoneId === clientPhoneRemove.clientPhoneId) {
                    clientPhoneRemove.inEdition = { clientPhone: { inEdition: false, clientPhoneId: null } }
                    clientPhoneRemove.clientPhoneForm = { reset: true }
                    addTabPhone.active = true
                }

                super.updateDraftRedis(clientPhoneRemove).then(() => {
                    this.controller.removeClientPhone(clientPhoneRemove).then((removedClientPhone) => {
                        this.server.io.in('draft/' + clientPhoneRemove.draftId).emit('draftClientPhoneRemove', removedClientPhone)
                        if (addTabPhone.active) this.server.io.in('draft/' + clientPhoneRemove.draftId).emit('draftClientPhoneEditionCancel')
                    }).catch(() => {
                        console.log('catch do REMOVE CLIENT ADDRESS - QUE É DENTRO DO ON ClientPhoneRemove')
                    })
                })
            })
        }
    // <-- end CLIENT ** phone

        ///////////////////////
        ///     CLIENT      ///
        /// ** customField  ///
        ///////////////////////
    // 
        /** 
         * Client Custom Field Add
         * @desc Send to all sockets in Draft/:id the client custom field add event
         * 
         * @param {object} customFieldAdd - expected: draftId, customFieldId, ? clientId 
         * @return {int} client custom id @property {Socket}
         */
        onClientCustomFieldAdd(customFieldAdd) {
            customFieldAdd.user = this.socket.user
            this.controller.clientCustomFieldAdd(customFieldAdd).then((addedCustomField) => {
                this.server.io.in('draft/' + customFieldAdd.draftId).emit('draftClientCustomFieldAdd', addedCustomField.clientCustomField)
            })
        }

        /** 
         * Client Custom Field Update
         * @desc Send to all sockets in Draft/:id the client custom field update event
         * 
         * @param {object} customFieldUpdate - expected: draftId, customFieldId, clientCustomFieldForm
         * @return {} @property {Socket}
         */
        onClientCustomFieldUpdate(customFieldUpdate) {
            this.setArrayDraftClientCustomField(customFieldUpdate).then((clientCustomField) => {
                /* super.updateDraftRedis(customFieldUpdate, true).then(() => { */
                this.socket.broadcast.in('draft/' + customFieldUpdate.draftId).emit('draftClientCustomFieldUpdate', clientCustomField)
                    super.timerSocketUpdate(customFieldUpdate.draftId)
                /* })*/
            })
        }

        /** 
         * Client Custom Field Remove
         * @desc Send to all sockets in Draft/:id the client custom field remove event
         * 
         * @param {object} clientCustomFieldRemove - expected: draftId, customFieldId
         * @return {int} client custom field id @property {Socket}
         */
        onClientCustomFieldRemove(clientCustomFieldRemove) {
            this.controller.clientCustomFieldRemove(clientCustomFieldRemove).then((customFieldReturn) => {
                this.server.io.in('draft/' + clientCustomFieldRemove.draftId).emit('draftClientCustomFieldRemove', customFieldReturn.clientCustomFieldId)
            })
        }
    
        ////////////////////////////////////
        //CUSTOM FIELD => SET PERSISTENCE //
        ////////////////////////////////////
        //
            /** 
             * Set Array Draft Client Custom Field
             * @desc Prepares the custom field update to persist in server memory
             * 
             * @param {object} clientCustomField - expected: draftId, customFieldId, clientCustomFieldForm
             * @return {object} clientCustomFieldId, clientCustomFieldForm @property {Promise}
             */
            setArrayDraftClientCustomField(clientCustomField) {
                return new Promise((resolve, reject) => {
                    return this.controller.getOne(clientCustomField.draftId).then((draft) => {
                        const draftUpdateMemory = _.find(this.channels.updates.drafts, { draftId: clientCustomField.draftId })

                        const indexClientCustomField = _.findIndex(draft.form.client.clientCustomFields, (customField) => { return customField.id === clientCustomField.clientCustomFieldId })
                        draft.form.client.clientCustomFields[indexClientCustomField] = _.assign(draft.form.client.clientCustomFields[indexClientCustomField], { value: _.toUpper(clientCustomField.clientCustomFieldForm.value) })

                        if (draftUpdateMemory) {
                            const draftUpdateIndex = this.channels.updates.drafts.indexOf(draftUpdateMemory)
                            this.channels.updates.drafts[draftUpdateIndex] = _.assign(this.channels.updates.drafts[draftUpdateIndex], draft)
                            resolve({ clientCustomFieldId: clientCustomField.clientCustomFieldId, clientCustomFieldForm: clientCustomField.clientCustomFieldForm })
                        }
                        else {
                            this.channels.updates.drafts.push(draft)
                            resolve({ clientCustomFieldId: clientCustomField.clientCustomFieldId, clientCustomFieldForm: clientCustomField.clientCustomFieldForm })
                        }
                    })
                })
            }
        // <-- end CUSTOM FIELD => SET PERSISTENCE

    // <-- end CLIENT ** customField

        ///////////////////////
        ///  CUSTOM FIELD   ///
        /// ** in company   ///
        ///////////////////////
    // 
        /** 
         * Custom Field Save
         * @desc Send to all sockets in Draft/:id the custom field save (create or update) event
         * 
         * @param {object} customFieldSave - expected: draftId, name, ? customFieldId 
         * @return {object} custom field @property {Socket}
         */
        onDraftCustomFieldSave(customFieldSave) {
            customFieldSave.user = this.socket.user
            this.controller.customFieldChange(customFieldSave).then((savedCustomField) => {
                this.server.io.in('draft/' + customFieldSave.draftId).emit('draftCustomFieldSave', savedCustomField.customFieldReturn)
            })
        }

        /** 
         * Custom Field Remove
         * @desc Send to all sockets in Draft/:id the custom field remove event
         * 
         * @param {object} customFieldRemove - expected: draftId, customFieldId 
         * @return {int} custom field id @property {Socket}
         */
        onDraftCustomFieldRemove(customFieldRemove) {
            customFieldRemove.user = this.socket.user
            customFieldRemove.remove = true
            this.controller.customFieldChange(customFieldRemove).then((removedCustomField) => {
                this.server.io.in('draft/' + customFieldRemove.draftId).emit('draftCustomFieldRemove', removedCustomField.customField.id)
            })
        }

    //<-- end CUSTOM FIELD ** in company

        ///////////////////////
        ///  CLIENT GROUP   ///
        /// ** in company   ///
        ///////////////////////
    // 
        /** 
         * Client Group Save
         * @desc Send to all sockets in Draft/:id the Client Group save (create or update) event
         * 
         * @param {object} clientGroupSave - expected: draftId, name 
         * @return {object} custom field @property {Socket}
         */
        onDraftClientGroupSave(clientGroupSave) {
            customFieldSave.user = this.socket.user
            this.controller.clientGroupChange(clientGroupSave).then((savedClientGroup) => {
                this.server.io.in('draft/' + clientGroupSave.draftId).emit('draftClientGroupSave', savedClientGroup.clientGroupReturn)
            })
        }

        /** 
         * Client Group Remove
         * @desc Send to all sockets in Draft/:id the Client Group remove event
         * 
         * @param {object} clientGroupRemove - expected: draftId, clientGroupId 
         * @return {int} custom field id @property {Socket}
         */
        onDraftClientGroupRemove(clientGroupRemove) {
            clientGroupRemove.user = this.socket.user
            clientGroupRemove.remove = true
            this.controller.clientGroupChange(clientGroupRemove).then((removedClientGroup) => {
                this.server.io.in('draft/' + clientGroupRemove.draftId).emit('draftClientGroupRemove', removedClientGroup.id)
            })
        }


    //<-- end CLIENT GROUP ** in company

//  <-- end CLIENT

    ///////////////////////
    ///     ORDEN       ///
    ///////////////////////
//

        /** 
         * Order User In Charge
         * @desc Send to all sockets in Draft/:id the user in charge event
         * 
         * @param {object} orderUserInCharge - expected: draftId, userId (atendent)
         * @return {object} @property {Socket}
         */
        onOrderUserInCharge(orderUserInCharge) {
            orderUserInCharge.triggeredBy = super.socket.user
            this.controller.orderUserIncharge(orderUserInCharge).then(() => {
                this.server.io.in('draft/' + orderUserInCharge.draftId).emit('draftOrderUserInCharge', orderUserInCharge.userId)
            }).catch(() => {
                console.log('catch do USER IN CHARGE - QUE É DENTRO DO ON ORDER USER IN CHARGE')
            })
        }
        
        //////////////////////
        ///     ORDEN      ///
        ///  ** product    ///
        //////////////////////
    //
        /**
         * Order Product Add
         * @desc Send to all sockets in Draft/:id the add form product event
         * 
         * @param {object} orderProductAdd - expected: draftId
         * @return {int} order Product Id @property {Socket}
         */
        onOrderProductAdd(orderProductAdd) {
            this.controller.orderProductAdd(orderProductAdd).then((orderProduct) => {
                this.server.io.in('draft/' + orderProductAdd.draftId).emit('draftOrderProductAdd', orderProduct.id)
            })
        }

        /**
         * Order Product Remove
         * @desc Send to all sockets in Draft/:id the remove form product event
         * 
         * @param {object} orderProductRemove - expected: draftId, OrderProductId
         * @return {int} order Product Id (removed) @property {Socket}
         */
        onOrderProductRemove(orderProductRemove) {
            this.controller.orderProductRemove(orderProductRemove).then(() => {
                this.server.io.in('draft/' + orderProductRemove.draftId).emit('draftOrderProductRemove', orderProductRemove.id)
            })
        }

        /**
         * Order Product Select
         * @desc Send to all sockets in Draft/:id that an product has been selected
         * 
         * @param {object} orderProductProductSelect - expected: draftId, productId, orderProductId
         * @return {object} address @property {Socket}
         */
        onOrderProductProductSelect(orderProductProductSelect) {
            this.controller.selectProductOrderProduct(orderProductProductSelect).then((product) => {
                this.server.io.in('draft/' + orderProductProductSelect.draftId).emit('draftOrderProductProductSelect', product)
            }).catch((err) => {
                console.log(err, 'catch do SELECT PRODUCT REQUEST PRODUCT')
            })
        }

        /** 
         * Order Product Reset
         * @desc Send to all sockets in Draft/:id the reset order product event
         * 
         * @param {object} orderProductProductReset - expected: draftId, orderProductId
         * @return {object} @property {Socket}
         */
        onOrderProductProductReset(orderProductProductReset) {
            this.controller.resetProductOrderProduct(orderProductProductReset).then(() => {
                this.server.io.in('draft/' + orderProductProductReset.draftId).emit('draftOrderProductProductReset', orderProductProductReset.orderProductId)
            }).catch(() => {
                console.log('catch do RESET ORDER PRODUCT - QUE É DENTRO DO ON ORDER PRODUCT RESET')
            })
        }
    //

//  

    ////////////////////////////////
    // HELPERS FUNCTIONS => DRAFT //
    ////////////////////////////////

    

}