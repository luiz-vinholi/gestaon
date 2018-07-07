import fs from 'fs'
import path from 'path'
import _ from 'lodash'
import config from '../config'
import EventResponse from '../models/EventResponse'

module.exports = class Events {

    /**
     * attach server instance, load socket.io events files
     * @param server
     */
    constructor(server){
        this.server = server
        this._versionInterval = null
        this.events = fs.readdirSync(path.join(__dirname, '/')).filter((fileName) => {
            return fileName !== 'index.js'
        }).map((directory) => {
            return {
                directoryName: directory,
                files: _.filter(fs.readdirSync(path.join(__dirname, '/', directory, '/')), (fileName) => {
                    return directory + '.js' !== fileName
                })
            }
        })
        this._setListeners()
    }

    /**
     * private
     * set main socket.io events
     */
    _setListeners(){
        const connectedSocketList = {}
        // for each connected user
        this.server.io.on('connection', (socket) => {

            if(!!this._versionInterval){
                clearInterval(this._versionInterval)
            }

            this._versionTimeInterval = setInterval(() => {
                socket.instance.emit('version', new EventResponse({
                    android: config.mainServer.androidVersion
                }))
            }, 1000 * 10)

            // get token and get connected user
            let token = socket.handshake.query.token
            socket = {
                instance: socket
            }
            this.server.mysql.UserAccessToken.findOne({
                where: {
                    accessToken: token
                },
                include: [
                    {
                        model: this.server.mysql.User,
                        as: 'user',
                        include: [
                            {
                                model: this.server.mysql.Company,
                                as: 'companies'
                            },
                            {
                                model: this.server.mysql.CompanyUser,
                                as: 'userCompanies'
                            }
                        ]
                    }
                ]
            }).then((userAccessToken) => {
                if (userAccessToken && typeof userAccessToken.user !== 'undefined') {
                    // initial setting when user connects, or reconnects
                    socket.user = userAccessToken.user
                    socket.activeUserCompany = _.find(socket.user.userCompanies, {
                        id: socket.user.activeCompanyUserId
                    })
                    if(!socket.activeUserCompany) socket.activeUserCompany =  _.first(socket.user.userCompanies)
                    socket.activeCompany = _.find(socket.user.companies, {
                        id: socket.activeUserCompany.companyId
                    })
                    if(!socket.activeCompany) socket.activeCompany =  _.first(socket.user.companies)

                    // join the user to its company events

                    socket.instance.join('company/' + socket.activeCompany.id)

                    connectedSocketList[socket.instance.id] = socket

                    // for the current user, join him to his tracking devices
                    socket.user.companies.forEach((company) => {
                        this.server.mongodb.Device.find({
                            companyId: company.id
                        }).exec().then((devices) => {
                            devices.forEach((device) => {
                                socket.instance.join('device/' + device.code)
                            })
                        }).catch((err) => {
                            console.log(err)
                        })
                    })
                    // Importing all events
                    this.events.forEach((event) => {
                        event.files.forEach((file) => {
                            const tEventFile = require('./' + event.directoryName + '/' + file)
                            new tEventFile(this.server, socket, connectedSocketList)
                        })
                    })
                }
            })
            socket.instance.on('disconnect', () => {
                if(!!this._versionInterval){
                    clearInterval(this._versionInterval)
                }
                delete connectedSocketList[socket.instance.id]
            })
            socket.instance.on('join-company-room', (companyId) => {
                // console.log(user.name + " joins device/" + deviceCode + ".")
                socket.join('company/' + companyId)
            })
            socket.instance.on('leave-company-room', (companyId) => {
                // console.log(user.name + " leaves device/" + deviceCode + ".")
                socket.leave('company/' + companyId)
            })
            socket.instance.on('join-device-room', (deviceCode) => {
                // console.log(user.name + " joins device/" + deviceCode + ".")
                socket.join('device/' + deviceCode)
            })
            socket.instance.on('leave-device-room', (deviceCode) => {
                // console.log(user.name + " leaves device/" + deviceCode + ".")
                socket.leave('device/' + deviceCode)
            })
        })
    }

}