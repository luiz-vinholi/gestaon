import Vue from "vue"
import config from '../config'

export default {
    getList(params = {}){
        return Vue.http.get(config.apiBaseUrl + '/cashier-balancing', { params }).then((response) => response.json());
    },
    markAsPaid(body, params = {}){
        return Vue.http.post(config.apiBaseUrl + '/cashier-balancing/mark-as-paid', body, { params }).then((response) => response.json());
    },
    markAsSettled(body, params = {}){
        return Vue.http.post(config.apiBaseUrl + '/cashier-balancing/mark-as-settled', body, { params }).then((response) => response.json());
    },
}