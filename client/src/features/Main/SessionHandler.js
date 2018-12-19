import _ from 'lodash'
import { Howl } from 'howler'
import Vue from 'vue'
import async from 'async'
import io from 'socket.io-client'
import ss from 'socket.io-stream'
import VueSocketio from 'vue-socket.io'
import moment from 'moment'
import elasticlunr from 'elasticlunr'
import UsersAPI from '../../api/users'
import Dexie from 'dexie'
import nGram from 'n-gram'
import pako from 'pako'

import utils from '../../utils'
import localForage from 'localforage'
import config from '../../config'

const alarmSound = require('../../assets/sounds/alarm.mp3')

export default {
    data(){
        return {
            currentImportedFileSize: 0,
            importFileSize: 0
        }
    },
    methods: {
        initializeSocketIO(){
            if (this.$socket) {
                this.$socket.destroy()
                delete this.$socket
                this.$socket = io(config.socketServer + '?token=' + this.tokens.accessToken)
                return
            }
            const socket = io(config.socketServer + '?token=' + this.tokens.accessToken)
            Vue.use(VueSocketio, socket)
        },
        disconnectSocketIO(){
            if (this.$socket) {
                this.$socket.removeListener('presence:load', this.onPresenceLoad)
                this.$socket.removeListener('connect', this.connect)
                this.$socket.destroy()
                delete this.$socket
                this.$socket = null
            }
        },
        socketMethods(){
            const vm = this
            return {
                reconnect(){
                    vm.stopLoading();
                    console.log("Reconnected.")
                },
                disconnect(reason){
                    vm.$socket.removeListener('presence:load', vm.onPresenceLoad)
                    vm.setLoadingText("Desconectado.")
                    vm.startLoading()
                    console.log("Disconnected from socket server. Reason: ", reason)
                },
                reconnectAttempt(attemptNumber){
                    vm.setLoadingText("Tentando reconectar (" + attemptNumber + ").")
                    vm.startLoading()
                    console.log("Trying reconnection.")
                }
            }
        },
        onPresenceLoad(ev){
            console.log("Received presence:load", ev)
            if(ev.success){
                this.setConnectedUsers(ev.evData)
            }
        },
        connect(){
            const vm = this
            vm.$socket.on("presence:load", vm.onPresenceLoad)
            new Promise((resolve) => {
                window.setAppLoadingText("Carregando usuário...")
                vm.setAuthUser().then(() => {
                    vm.menuList = _.filter(vm.menuList, (menuItem) => {
                        if(menuItem.type === 'system'){
                            if(menuItem.onlyAdmin && vm.user.type === 'admin'){
                                return true;
                            }
                            else if(!menuItem.onlyAdmin){
                                return true;
                            }
                        }
                    });
                    vm.user.userCompanies.forEach((userCompany) => {
                        vm.menuList.unshift({
                            text: userCompany.company.name,
                            type: 'company',
                            action: () => {
                                console.log("Feature yet to be implemented")
                            },
                            param: userCompany
                        })
                    });
                    console.log("Authenticated user set.")
                    resolve('Authenticated user set.')
                }).catch(() => {
                    vm.stopLoading()
                    console.log("Couldn't get authenticated user.")
                    vm.logout()
                })
            }).then(() => {
                return Promise.all([
                    vm.loadAllUsers({ companyId: vm.company.id }),
                    vm.loadAllClientGroups({ companyId: vm.company.id }),
                    vm.loadAllPaymentMethods({ companyId: vm.company.id }),
                    vm.loadAllPromotionChannels({ companyId: vm.company.id }),
                    vm.loadAllAccounts({ companyId: vm.company.id }),
                    vm.loadAllProducts({ companyId: vm.company.id }),
                    vm.loadMorphScreenData(vm.company.id)
                ])
            }).then(() => {
                /*vm.$db.delete().then(() => {
                    console.log("Deleted")
                })*/

                // set elasticlunr tokenizer
                elasticlunr.tokenizer = function (str) {
                    //console.log(`-------- Executando ${arguments.length} ---------`)
                    if (!arguments.length || str === null || str === undefined) return [];
                    if (Array.isArray(str)) {
                        let arr = str.filter(function(token) {
                            if (token === null || token === undefined) {
                                return false;
                            }

                            return true;
                        });

                        arr = arr.map(function (t) {
                            return elasticlunr.utils.toString(t).toLowerCase();
                        });

                        let out = [];
                        arr.forEach(function(item) {
                            const tokens = item.split(elasticlunr.tokenizer.seperator);
                            out = out.concat(tokens);
                        }, this);

                        return out;
                    }

                    // edge n-gram

                    const strArray = str.toString().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/,?\s+/)

                    const edgeNGram = function(xD){
                        let i = 1
                        const wordLength = xD.length
                        const resultArray = []
                        while(i <= wordLength){
                            resultArray.push(xD.substr(0,i))
                            i++
                        }
                        return resultArray
                    }

                    let finalArray = []

                    strArray.forEach((str) => {
                        finalArray = _.concat(finalArray, edgeNGram(str))
                    })

                    return finalArray
                }

                vm.$db.clients.count().then((numberOfClients) => {
                    /*
                    * if db imported previously
                    * */
                    if(numberOfClients){
                        window.setAppLoadingText(`Carregando ${numberOfClients} clientes...`)

                        let stream = ss.createStream()
                        ss(vm.$socket).emit('import', stream)
                        vm.$socket.on('import', (ev) => {
                            console.log("Import event received", ev)
                            vm.importFileSize = ev.fileSize
                            const arrayOfChunks = []
                            stream.on('data', function(chunk){
                                vm.currentImportedFileSize += chunk.length
                                arrayOfChunks.push(chunk)
                                window.setAppLoadingText(`Baixando BD (${vm.currentImportedFileSize}/${vm.importFileSize}): ${Math.floor(vm.currentImportedFileSize / vm.importFileSize * 100)}%`)
                            })
                            stream.on('end', function(){
                                async.waterfall([
                                    async.asyncify(() => {
                                        const input = ss.Buffer.concat(arrayOfChunks)
                                        let output = pako.ungzip(input, {
                                            to: "string"
                                        })
                                        return JSON.parse(output)
                                    }),
                                    async.asyncify((downloadedData) => {
                                        vm.$db.users.bulkPut(downloadedData.users)
                                        vm.$db.clients.bulkPut(downloadedData.clients)
                                        vm.$db.addresses.bulkPut(downloadedData.addresses)
                                        vm.$db.clientPhones.bulkPut(downloadedData.clientPhones)
                                        vm.$db.clientAddresses.bulkPut(downloadedData.clientAddresses)
                                        vm.$db.products.bulkPut(downloadedData.products)
                                        vm.$db.promotionChannels.bulkPut(downloadedData.promotionChannels)
                                        vm.$db.clientGroups.bulkPut(downloadedData.clientGroups)
                                        vm.$db.customFields.bulkPut(downloadedData.customFields)
                                        vm.$db.paymentMethods.bulkPut(downloadedData.paymentMethods)
                                        console.log("Data imported to indexedDB", downloadedData)
                                        return downloadedData
                                    })
                                ], (err, downloadedData) => {
                                    const processChunkOfClients = function(chunkOfClients){
                                        return new Promise((resolve, reject) => {
                                            const arrayToIndex = []
                                            async.each(chunkOfClients, (client, cb) => {
                                                vm.$db.clientAddresses.where('clientId').equals(client.id).toArray().then((clientAddresses) => {
                                                    if(clientAddresses.length){
                                                        Promise.all(clientAddresses.map((clientAddress) => {
                                                            return vm.$db.addresses.get(clientAddress.addressId).then((address) => {
                                                                arrayToIndex.push({
                                                                    id: client.id + '#' + _.get(clientAddress,'id',0),
                                                                    name: client.name,
                                                                    address: _.get(address,'name',null),
                                                                    neighborhood: _.get(address,'neighborhood',null),
                                                                    number: (_.get(clientAddress,'number',false)) ? '' + _.get(clientAddress,'number') : null,
                                                                    complement: _.get(clientAddress,'complement',null),
                                                                    city: _.get(address,'city',null),
                                                                    state: _.get(address,'state',null)
                                                                })
                                                                return address
                                                            })
                                                        })).then(() => {
                                                            cb(null, client)
                                                        })
                                                    }
                                                    else {
                                                        arrayToIndex.push({
                                                            id: client.id + "#" + 0,
                                                            name: client.name,
                                                            address: null,
                                                            neighborhood: null,
                                                            number: null,
                                                            complement: null,
                                                            city: null,
                                                            state: null
                                                        })
                                                        cb(null, client)
                                                    }
                                                })
                                            }, (err, clients) => {
                                                resolve(arrayToIndex)
                                            })
                                        })
                                    }
                                    const processChunkOfAddresses = function(chunkOfAddresses){
                                        return new Promise((resolve, reject) => {
                                            const arrayToIndex = []
                                            async.each(chunkOfAddresses, (address, cb) => {
                                                arrayToIndex.push({
                                                    id: address.id,
                                                    name: _.get(address,'name',null),
                                                    address: _.get(address,'name',null),
                                                    neighborhood: _.get(address,'neighborhood',null),
                                                    city: _.get(address,'city',null),
                                                    state: _.get(address,'state',null),
                                                    cep: _.get(address,'cep',null),
                                                    country: _.get(address,'country',null)
                                                })
                                                cb(null, address)
                                            }, (err, addresses) => {
                                                resolve(arrayToIndex)
                                            })
                                        })
                                    }

                                    // begin clients import

                                    vm.$db.clients.count().then((numberOfClients) => {
                                        return new Promise((resolve, reject) => {
                                            let resultArray = []
                                            let offset = 0, limit = 100
                                            const processInChunks = function(){
                                                if(offset > numberOfClients){
                                                    return resolve(resultArray)
                                                }
                                                window.setAppLoadingText(`Carregando clientes: ${Math.round(offset/numberOfClients * 100)}%`)
                                                vm.$db.clients.offset(offset).limit(limit).toArray().then((clients) => {
                                                    processChunkOfClients(clients).then((processedChunkOfClients) => {
                                                        resultArray = _.concat(resultArray, processedChunkOfClients)
                                                        offset += limit
                                                        processInChunks()
                                                    })
                                                })
                                            }
                                            processInChunks()
                                        })
                                    }).then((documents) => {
                                        vm.$db.searchClients.bulkPut(documents)
                                        vm.$static.searchClientsIndex = elasticlunr(function () {
                                            this.setRef('id')
                                            this.addField('name')
                                            this.addField('address')
                                            this.addField('complement')
                                            this.addField('number')
                                            this.addField('neighborhood')
                                            this.addField('city')
                                            this.addField('state')
                                            documents.forEach((doc) => {
                                                this.addDoc(doc)
                                            }, this)
                                        })

                                        // begin addresses import

                                        vm.$db.addresses.count().then((numberOfAddresses) => {
                                            return new Promise((resolve, reject) => {
                                                let resultArray = []
                                                let offset = 0, limit = 100
                                                const processInChunks = function(){
                                                    if(offset > numberOfAddresses){
                                                        return resolve(resultArray)
                                                    }
                                                    window.setAppLoadingText(`Carregando endereços: ${Math.round(offset/numberOfAddresses * 100)}%`)
                                                    vm.$db.addresses.offset(offset).limit(limit).toArray().then((addresses) => {
                                                        processChunkOfAddresses(addresses).then((processedChunkOfAddresses) => {
                                                            resultArray = _.concat(resultArray, processedChunkOfAddresses)
                                                            offset += limit
                                                            processInChunks()
                                                        })
                                                    })
                                                }
                                                processInChunks()
                                            })
                                        }).then((documents) => {
                                            vm.$db.searchAddresses.bulkPut(documents)
                                            vm.$static.searchAddressesIndex = elasticlunr(function () {
                                                this.setRef('id')
                                                this.addField('name')
                                                this.addField('address')
                                                this.addField('neighborhood')
                                                this.addField('city')
                                                this.addField('state')
                                                this.addField('cep')
                                                this.addField('country')
                                                documents.forEach((doc) => {
                                                    this.addDoc(doc)
                                                }, this)
                                                // initialize
                                                if(window.isAppLoading()){
                                                    window.removeAppLoading()
                                                }
                                                vm.stopLoading()
                                                vm.setSystemInitialized(true)
                                            })
                                        })

                                        /* import to lunr search engine */
                                        vm.$static.searchClientsIndex = elasticlunr(function () {
                                            _.forEach(elasticlunr.Pipeline.registeredFunctions, (value, key) => {
                                                if(key === 'stemmer'){
                                                    this.pipeline.remove(value)
                                                }
                                                else if(key === 'stopWordFilter'){
                                                    this.pipeline.remove(value)
                                                }
                                            })
                                            this.setRef('id')
                                            this.addField('name')
                                            this.addField('address')
                                            this.addField('complement')
                                            this.addField('number')
                                            this.addField('neighborhood')
                                            this.addField('city')
                                            this.addField('state')
                                            vm.$db.searchClients.toArray().then((documents) => {
                                                documents.forEach(function(doc){
                                                    this.addDoc(doc)
                                                }, this)
                                                // initialize
                                                if(window.isAppLoading()) {
                                                    window.removeAppLoading()
                                                }
                                                vm.stopLoading()
                                                vm.setSystemInitialized(true)
                                            })
                                        })
                                        vm.$static.searchAddressesIndex = elasticlunr(function () {
                                            _.forEach(elasticlunr.Pipeline.registeredFunctions, (value, key) => {
                                                if(key === 'stemmer'){
                                                    this.pipeline.remove(value)
                                                }
                                                else if(key === 'stopWordFilter'){
                                                    this.pipeline.remove(value)
                                                }
                                            })
                                            this.setRef('id')
                                            this.addField('name')
                                            this.addField('address')
                                            this.addField('neighborhood')
                                            this.addField('city')
                                            this.addField('state')
                                            this.addField('cep')
                                            this.addField('country')
                                            vm.$db.searchAddresses.toArray().then((documents) => {
                                                documents.forEach(function(doc){
                                                    this.addDoc(doc)
                                                }, this)
                                                // initialize
                                                if(window.isAppLoading()) {
                                                    window.removeAppLoading()
                                                }
                                                vm.stopLoading()
                                                vm.setSystemInitialized(true)
                                            })
                                        })
                                        vm.$db.products.toArray().then((products) => {
                                            vm.$store.dispatch('entities/products/insert', {
                                                data: products
                                            })
                                        })
                                        vm.$db.paymentMethods.toArray().then((paymentMethods) => {
                                            vm.$store.dispatch('entities/paymentMethods/insert', {
                                                data: paymentMethods
                                            })
                                        })
                                        vm.$db.promotionChannels.toArray().then((promotionChannels) => {
                                            vm.$store.dispatch('entities/promotionChannels/insert', {
                                                data: promotionChannels
                                            })
                                        })
                                        vm.$db.users.toArray().then((users) => {
                                            vm.$store.dispatch('entities/users/insert', {
                                                data: users
                                            })
                                        })
                                        vm.$db.clientGroups.toArray().then((users) => {
                                            vm.$store.dispatch('entities/clientGroups/insert', {
                                                data: users
                                            })
                                        })

                                    })
                                })
                            })
                        })


                    }
                    else {
                        // no clients
                        let stream = ss.createStream()
                        ss(vm.$socket).emit('import', stream)
                        vm.$socket.on('import', (ev) => {
                            console.log("Import event received", ev)
                            vm.importFileSize = ev.fileSize
                            const arrayOfChunks = []
                            stream.on('data', function(chunk){
                                vm.currentImportedFileSize += chunk.length
                                arrayOfChunks.push(chunk)
                                window.setAppLoadingText(`Baixando BD (${vm.currentImportedFileSize}/${vm.importFileSize}): ${Math.floor(vm.currentImportedFileSize / vm.importFileSize * 100)}%`)
                            })
                            stream.on('end', function(){
                                async.waterfall([
                                    async.asyncify(() => {
                                        const input = ss.Buffer.concat(arrayOfChunks)
                                        let output = pako.ungzip(input, {
                                            to: "string"
                                        })
                                        return JSON.parse(output)
                                    }),
                                    async.asyncify((downloadedData) => {
                                        vm.$db.users.bulkPut(downloadedData.users)
                                        vm.$db.clients.bulkPut(downloadedData.clients)
                                        vm.$db.addresses.bulkPut(downloadedData.addresses)
                                        vm.$db.clientPhones.bulkPut(downloadedData.clientPhones)
                                        vm.$db.clientAddresses.bulkPut(downloadedData.clientAddresses)
                                        vm.$db.products.bulkPut(downloadedData.products)
                                        vm.$db.promotionChannels.bulkPut(downloadedData.promotionChannels)
                                        vm.$db.clientGroups.bulkPut(downloadedData.clientGroups)
                                        vm.$db.customFields.bulkPut(downloadedData.customFields)
                                        vm.$db.paymentMethods.bulkPut(downloadedData.paymentMethods)
                                        console.log("Data imported to indexedDB", downloadedData)
                                        return downloadedData
                                    })
                                ], (err, downloadedData) => {
                                    const processChunkOfClients = function(chunkOfClients){
                                        return new Promise((resolve, reject) => {
                                            const arrayToIndex = []
                                            async.each(chunkOfClients, (client, cb) => {
                                                vm.$db.clientAddresses.where('clientId').equals(client.id).toArray().then((clientAddresses) => {
                                                    if(clientAddresses.length){
                                                        Promise.all(clientAddresses.map((clientAddress) => {
                                                            return vm.$db.addresses.get(clientAddress.addressId).then((address) => {
                                                                arrayToIndex.push({
                                                                    id: client.id + '#' + _.get(clientAddress,'id',0),
                                                                    name: client.name,
                                                                    address: _.get(address,'name',null),
                                                                    neighborhood: _.get(address,'neighborhood',null),
                                                                    number: (_.get(clientAddress,'number',false)) ? '' + _.get(clientAddress,'number') : null,
                                                                    complement: _.get(clientAddress,'complement',null),
                                                                    city: _.get(address,'city',null),
                                                                    state: _.get(address,'state',null)
                                                                })
                                                                return address
                                                            })
                                                        })).then(() => {
                                                            cb(null, client)
                                                        })
                                                    }
                                                    else {
                                                        arrayToIndex.push({
                                                            id: client.id + "#" + 0,
                                                            name: client.name,
                                                            address: null,
                                                            neighborhood: null,
                                                            number: null,
                                                            complement: null,
                                                            city: null,
                                                            state: null
                                                        })
                                                        cb(null, client)
                                                    }
                                                })
                                            }, (err, clients) => {
                                                resolve(arrayToIndex)
                                            })
                                        })
                                    }
                                    const processChunkOfAddresses = function(chunkOfAddresses){
                                        return new Promise((resolve, reject) => {
                                            const arrayToIndex = []
                                            async.each(chunkOfAddresses, (address, cb) => {
                                                arrayToIndex.push({
                                                    id: address.id,
                                                    name: _.get(address,'name',null),
                                                    address: _.get(address,'name',null),
                                                    neighborhood: _.get(address,'neighborhood',null),
                                                    city: _.get(address,'city',null),
                                                    state: _.get(address,'state',null),
                                                    cep: _.get(address,'cep',null),
                                                    country: _.get(address,'country',null)
                                                })
                                                cb(null, address)
                                            }, (err, addresses) => {
                                                resolve(arrayToIndex)
                                            })
                                        })
                                    }

                                    // begin clients import

                                    vm.$db.clients.count().then((numberOfClients) => {
                                        return new Promise((resolve, reject) => {
                                            let resultArray = []
                                            let offset = 0, limit = 100
                                            const processInChunks = function(){
                                                if(offset > numberOfClients){
                                                    return resolve(resultArray)
                                                }
                                                window.setAppLoadingText(`Carregando clientes: ${Math.round(offset/numberOfClients * 100)}%`)
                                                vm.$db.clients.offset(offset).limit(limit).toArray().then((clients) => {
                                                    processChunkOfClients(clients).then((processedChunkOfClients) => {
                                                        resultArray = _.concat(resultArray, processedChunkOfClients)
                                                        offset += limit
                                                        processInChunks()
                                                    })
                                                })
                                            }
                                            processInChunks()
                                        })
                                    }).then((documents) => {
                                        vm.$db.searchClients.bulkPut(documents)
                                        vm.$static.searchClientsIndex = elasticlunr(function () {
                                            this.setRef('id')
                                            this.addField('name')
                                            this.addField('address')
                                            this.addField('complement')
                                            this.addField('number')
                                            this.addField('neighborhood')
                                            this.addField('city')
                                            this.addField('state')
                                            documents.forEach((doc) => {
                                                this.addDoc(doc)
                                            }, this)
                                        })

                                        // begin addresses import

                                        vm.$db.addresses.count().then((numberOfAddresses) => {
                                            return new Promise((resolve, reject) => {
                                                let resultArray = []
                                                let offset = 0, limit = 100
                                                const processInChunks = function(){
                                                    if(offset > numberOfAddresses){
                                                        return resolve(resultArray)
                                                    }
                                                    window.setAppLoadingText(`Carregando endereços: ${Math.round(offset/numberOfAddresses * 100)}%`)
                                                    vm.$db.addresses.offset(offset).limit(limit).toArray().then((addresses) => {
                                                        processChunkOfAddresses(addresses).then((processedChunkOfAddresses) => {
                                                            resultArray = _.concat(resultArray, processedChunkOfAddresses)
                                                            offset += limit
                                                            processInChunks()
                                                        })
                                                    })
                                                }
                                                processInChunks()
                                            })
                                        }).then((documents) => {
                                            vm.$db.searchAddresses.bulkPut(documents)
                                            vm.$static.searchAddressesIndex = elasticlunr(function () {
                                                this.setRef('id')
                                                this.addField('name')
                                                this.addField('address')
                                                this.addField('neighborhood')
                                                this.addField('city')
                                                this.addField('state')
                                                this.addField('cep')
                                                this.addField('country')
                                                documents.forEach((doc) => {
                                                    this.addDoc(doc)
                                                }, this)
                                                // initialize
                                                if(window.isAppLoading()){
                                                    window.removeAppLoading()
                                                }
                                                vm.stopLoading()
                                                vm.setSystemInitialized(true)
                                            })
                                        })

                                    })
                                })
                            })
                        })
                    }
                })
            })
        },
        logout(){
            const vm = this;

            vm.logoutAction().then((authenticated) => {
                if(!authenticated){
                    vm.$router.replace("/login")
                }
            });
        }
    },
    mounted(){
        const vm = this;
        localStorage.debug = false
        /* start socket.io */
        this.initializeSocketIO()
        /* if user disconnected / reconnected from socket server */
        this.$socket.on('reconnect_attempt', vm.socketMethods.reconnectAttempt)
        this.$socket.on('disconnect', vm.socketMethods.disconnect)
        this.$socket.on('connect', vm.connect)
    },
    beforeDestroy(){
        this.disconnectSocketIO()
    }
}