import Vue from "vue"
import config from '../config'

export default {
    persistence(body, params = {}){
        return Vue.http.post(config.apiBaseUrl + '/clients/persistence', body, { params }).then((response) => response.json())
    },
    createOne(body){
        return Vue.http.post(config.apiBaseUrl + '/clients', body).then((response) => response.json())
    },
    getOne(id, params = {}){
        return Vue.http.get(config.apiBaseUrl + '/clients/' + id, { params }).then((response) => response.json())
    },
    updateOne(clientId, body){
        return Vue.http.patch(config.apiBaseUrl + '/clients/' + clientId, body).then((response) => response.json())
    },
    removeOneClientAddress(clientId, addressId){
        return Vue.http.delete(config.apiBaseUrl + '/clients/' + clientId + '/addresses/' + addressId).then((response) => response.json())
    },
    getOneClientAddress(clientId, addressId){
        return Vue.http.get(config.apiBaseUrl + '/clients/' + clientId + '/addresses/' + addressId).then((response) => response.json())
    },
    saveAddresses(clientId, body, params){
        return Vue.http.patch(config.apiBaseUrl + '/clients/' + clientId + '/addresses', { clientAddresses: body }, { params }).then((response) => response.json())
    },
    removeOneClientPhone(clientId, clientPhoneId, params){
        return Vue.http.delete(config.apiBaseUrl + '/clients/' + clientId + '/phones/' + clientPhoneId, { params }).then((response) => response.json())
    },
    getOneClientPhone(clientId, phoneId){
        return Vue.http.get(config.apiBaseUrl + '/clients/' + clientId + '/phones/' + phoneId).then((response) => response.json())
    },
    savePhones(clientId, body, params){
        return Vue.http.patch(config.apiBaseUrl + '/clients/' + clientId + '/phones', { clientPhones: body }, { params }).then((response) => response.json())
    },
    getRequestHistory(id, params = {}){
        return Vue.http.get(config.apiBaseUrl + '/clients/' + id + '/request-history', { params }).then((response) => response.json())
    },
    getCreditInfo(id, params = {}){
        return Vue.http.get(config.apiBaseUrl + '/clients/' + id + '/credit-info', { params }).then((response) => response.json())
    },
    getBills(id, params = {}){
        return Vue.http.get(config.apiBaseUrl + '/clients/' + id + '/bills', { params }).then((response) => response.json())
    },
    changeCreditLimit(clientId, body, params){
        return Vue.http.post(config.apiBaseUrl + '/clients/' + clientId + '/change-credit-limit', body, { params }).then((response) => response.json())
    },
    search(params){
        return Vue.http.get(config.apiBaseUrl + '/clients/search', { params }).then((response) => response.json())
    }
}
