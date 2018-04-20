const _ = require('lodash')
const Controller = require('../../models/Controller')
const shortid = require('shortid')
const Op = require('Sequelize').Op
const RequestRecoverance = require('../../modules/Draft/Recoverance/RequestRecoverance')
const EventResponse = require('~server/models/EventResponse')
const {PermissionError} = require('~errors')

module.exports = class RequestBoard {

    constructor(server, socket) {
        // global variabels
        this.server = server
        this.socket = socket
  
        this.requestsController = require('../../controllers/requests.controller')(server)
        this.requestTimelineController = require('../../controllers/requests-timeline.controller')(server)
        this.requestRecoverance = new RequestRecoverance(server)

        //private
        this._defaultPosition = 65535

        // functions
        this.setEventListeners()
    }

    /**
     * Events on Request Listeners
     */
    setEventListeners() {

        const vm = this
        const activeCompanyUserId = (vm.socket.user.activeCompanyUserId) ? vm.socket.user.activeCompanyUserId : _.first(vm.socket.user.companies)
        
       this.socket.on('request-board:request-recoverance', (evData) => {
        /**
        * Request Recoverance
        * @desc Send to all sockets in Draft/:id the recoverance event
        *
        * @param {object} evData - expected: cardId, companyId
        * @return {object} *Draft @property {Socket}
        */

        return vm.server.mongodb.Card.findOne({ _id: evData.cardId }, {}, { sort: { position: 1 } }, function (err, card) {
               return card
        }).then((card) => {
               this.requestRecoverance.setRequestId(card.requestId)
               this.requestRecoverance.setCompanyId(evData.companyId)
               this.requestRecoverance.setRecoverancedBy(this.socket.user)

               this.requestRecoverance.start().then((draft) => {
                   vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardRequestRecoverance', draft)
               }).catch((err) => {
                   console.log('ERRO: REQUEST RECOVERANCE: ', err)
               })
           })
        })

        this.socket.on('request-board:load', () => {
            vm.socket.join('company/' + activeCompanyUserId + '/request-board') // subscribe the user to its request-board company channel
            vm.server.broker.call('request-board.load', {
                data: {
                    companyId: activeCompanyUserId
                }
            }).then((sections) => {
                vm.socket.emit('requestBoardLoad', new EventResponse({sections}))
            }).catch((err) => {
                console.log(err)
            })
        })

        /**
         * On section create
         */
        this.socket.on('request-board:section-create', () => {
            vm.server.broker.call('request-board.createSection', {
                data: {
                    companyId: activeCompanyUserId
                }
            }).catch((err) => {
                console.log(err)
            })
        })

        /**
         * On section remove
         */
        this.socket.on('request-board:section-remove', (evData) => {
            vm.server.mongodb.Card.count({
                section: evData.sectionId
            }, function(err, count) {
                if(count > 0){
                    vm.socket.emit('requestBoardSectionRemove', {
                        success: false,
                        message: "Você não pode remover uma seção que possui pedido(s)."
                    })
                }
                else {
                    vm.server.mongodb.Section.remove({
                        _id: evData.sectionId
                    }, function(){
                        vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardSectionRemove', {
                            success: true,
                            data: {
                                section: {
                                    id: evData.sectionId
                                }
                            }
                        })
                    })
                }
            })
        })

        /**
         * On section move
         */
        this.socket.on('request-board:section-move', (evData) => {
            console.log("Section moved", evData)
            switch(evData.location){
                case "first":
                    vm.server.mongodb.Section.findOne({}, {}, { sort: { position: 1 } }, function(err, firstSection) {
                        let position = firstSection.position / 2
                        vm.server.mongodb.Section.findOneAndUpdate({
                            _id: evData.sectionId
                        }, {
                            $set: {
                                position
                            }
                        }).then((section) => {
                            _.assign(section, { position })
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardSectionMove', {
                                data: { location: 'first', section }
                            })
                        }).catch((err) => {
                            console.log(err)
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardSectionMove', new Error(err))
                        })
                    })
                    break;
                case "last":
                    vm.server.mongodb.Section.findOne({}, {}, { sort: { position: -1 } }, function(err, lastSection) {
                        let position = vm._defaultPosition
                        if(lastSection) position += lastSection.position
                        vm.server.mongodb.Section.findOneAndUpdate({
                            _id: evData.sectionId
                        }, {
                            $set: {
                                position
                            }
                        }).then((section) => {
                            _.assign(section, { position })
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardSectionMove', {
                                data: { location: 'last', section }
                            })
                        }).catch((err) => {
                            console.log(err)
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardSectionMove', new Error(err))
                        })
                    })
                    break;
                default:
                    console.log("evData",evData)
                    vm.server.mongodb.Section.findOneAndUpdate({
                        _id: evData.sectionId
                    }, {
                        $set: {
                            position: evData.position
                        }
                    }).then((section) => {
                        _.assign(section, { position: evData.position })
                        vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardSectionMove', {
                            data: { location: 'middle', section }
                        })
                    }).catch((err) => {
                        console.log(err)
                        vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardSectionMove', new Error(err))
                    })
            }

        })

        /**
         * On card move
         */
        this.socket.on('request-board:card-move', (evData) => {
            console.log("Card moved", evData)

            switch(evData.location){
                case "first":
                    vm.server.mongodb.Card.findOne({ section: evData.toSection}, {}, { sort: { position: 1 } }, function(err, firstCard) {
                        console.log('firstCard', firstCard.position)
                        let position = firstCard.position / 2
                        vm.saveCard(evData.cardId, evData.toSection, position).then(() => {
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardCardMove', {
                                data: { location: 'first' }
                            })
                        }).catch((err) => {
                            console.log(err)
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardCardMove', new Error(err))
                        })
                    })
                    break;
                case "last":
                    vm.server.mongodb.Card.findOne({ section: evData.toSection }, {}, { sort: { position: -1 } }, function(err, lastCard) {
                        let position = vm._defaultPosition
                        if(lastCard) position += lastCard.position
                        vm.saveCard(evData.cardId, evData.toSection, position).then(() => {
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardCardMove', {
                                data: { location: 'last' }
                            })
                        }).catch((err) => {
                            console.log(err)
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardCardMove', new Error(err))
                        })
                    })
                    break;
                case "middle":
                    vm.server.mongodb.Card.find({ section: evData.toSection, _id: { $in: [evData.prevCard, evData.nextCard] } }, function(err, prevAndNextCard) {
                        prevAndNextCard.sort(function(a, b){return b.position - a.position})
                        const position = ( prevAndNextCard[0].position + prevAndNextCard[1].position ) / 2
                        vm.saveCard(evData.cardId, evData.toSection, position).then(() => {
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardCardMove', {
                                data: { location: 'middle' }
                            })
                        }).catch((err) => {
                            console.log(err)
                            vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardCardMove', new Error(err))
                        })
                    })
                    break;
                case "last-and-only":
                    console.log("last-and-only")
                    let position = vm._defaultPosition
                    vm.saveCard(evData.cardId, evData.toSection, position).then(() => {
                        vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardCardMove', {
                            data: { location: 'last-and-only' }
                        })
                    }).catch((err) => {
                        console.log(err)
                        vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardCardMove', new Error(err))
                    })
                    break;
            }
        }),

        /**
         * On change request's status
         */
            this.socket.on('request-board:request-timeline:change-status', (evData) => {

                return vm.server.mongodb.Card.findOne({ _id: evData.cardId }, {}, { sort: { position: 1 } }, function (err, card) {
                    return card
                }).then((card) => {
                    return new Promise((resolve, reject) => {
                        const controller = new Controller({
                            request: {
                                id: card.requestId,
                                companyId: card.companyId
                            }
                        })
                        this.requestsController.getOne(controller).then((request) => {
                            const statusController = new Controller({
                                request: {
                                    request: request,
                                    data: {
                                        status: evData.status,
                                        triggeredBy: vm.socket.user.id
                                    }
                                }
                            })

                            this.requestTimelineController.changeStatus(statusController).then((response) => {
                                const data = {
                                    success: true,
                                    data: {
                                        cardId: evData.cardId,
                                        requestTimelineItem: response
                                    }
                                }
                                resolve(data)
                            }).catch((err) => {
                                const error = {
                                    success: false,
                                    message: "Não é possivel alterar o status do pedido!",
                                    errorCode: "ERROR"
                                }
                                reject(error)
                            })
                        })
                    }).then((data) => {
                        vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardRequestTimelineChangeStatus', data)
                    }).catch((err) => {
                        vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardRequestTimelineChangeStatus', err)
                    })
                })
            })


        /**
         * On change request's user
         */
        this.socket.on('request-board:request-timeline:change-user', (evData) => {

            return vm.server.mongodb.Card.findOne({ _id: evData.cardId }, {}, { sort: { position: 1 } }, function (err, card) {
                return card
            }).then((card) => {
                return new Promise((resolve, reject) => {
                    const controller = new Controller({
                        request: {
                            id: card.requestId,
                            companyId: card.companyId
                        }
                    })
                    this.requestsController.getOne(controller).then((request) => {
                        const statusController = new Controller({
                            request: {
                                request: request,
                                data: {
                                    userId: evData.userId,
                                    triggeredBy: vm.socket.user.id
                                },
                                companyId: activeCompanyUserId
                            }
                        })

                        this.requestTimelineController.changeUser(statusController).then((response) => {
                            const data = {
                                success: true,
                                data: {
                                    cardId: evData.cardId,
                                    requestTimelineItem: response
                                }
                            }
                            resolve(data)
                        }).catch((err) => {
                            const error = {
                                success: false,
                                message: "Não é possivel alterar o usuario do pedido!",
                                errorCode: "ERROR"
                            }
                            reject(error)
                        })
                    })
                }).then((data) => {
                    vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardRequestTimelineChangeUser', data)
                }).catch((err) => {
                    vm.server.io.in('company/' + activeCompanyUserId + '/request-board').emit('requestBoardRequestTimelineChangeUser', err)
                })
            })
        })

    }


    saveCard(cardId, toSectionId, position){
        const vm = this
        return vm.server.mongodb.Card.findOne({
            _id: cardId
        }).then((card) => {
            const prevSectionId = card.section.toString()
            _.assign(card, {
                position,
                section: toSectionId
            })
            return card.save().then(() => {
                if(prevSectionId !== toSectionId) { // only execute here if card is going to another section
                    const removeCardFromPrevSection = vm.server.mongodb.Section.findOne({
                        _id: prevSectionId
                    }).then((prevSection) => {
                        const prevSectionCardIndex = _.findIndex(prevSection.cards, card._id)
                        prevSection.cards.splice(prevSectionCardIndex, 1)
                        return prevSection.save()
                    })
                    const addCardToNextSection = vm.server.mongodb.Section.findOne({
                        _id: toSectionId
                    }).then((toSection) => {
                        toSection.cards.push(card._id)
                        return toSection.save()
                    })
                    return Promise.all([removeCardFromPrevSection, addCardToNextSection])
                }
            })
        })
    }

}