import Sequelize from 'sequelize'
import _ from 'lodash'

module.exports = {
    defineModel: (server) => {
        const TIMESTAMP = require('sequelize-mysql-timestamp')(server.sequelize);
        const modelName = 'Client';
        return {
            name: modelName,
            instance: server.sequelize.define(_.camelCase(modelName), {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                companyId: {
                    type: Sequelize.INTEGER
                },
                name: {
                    type: Sequelize.STRING,
                    set(val) {
                        this.setDataValue('name', (val == '' | val == null) ? null : val.toUpperCase().trim());
                    }
                },
                obs: {
                    type: Sequelize.STRING,
                    set(val) {
                        this.setDataValue('obs', (val == '' | val == null) ? null : val.toUpperCase().trim());
                    }
                },
                clientGroupId: {
                    type: Sequelize.INTEGER
                },
                legalDocument: {
                    type: Sequelize.STRING,
                    set(val) {
                        this.setDataValue('legalDocument', (val == '' | val == null) ? null : val.toUpperCase().trim());
                    }
                },
                dateUpdated: {
                    type: TIMESTAMP
                },
                dateCreated: {
                    type: TIMESTAMP
                },
                dateRemoved: {
                    type: TIMESTAMP
                },
                status: {
                    type: Sequelize.STRING,
                    defaultValue: 'activated'
                },
                origin: {
                    type: Sequelize.STRING
                }
            }, {
                tableName: "client",
                timestamps: true,
                updatedAt: 'dateUpdated',
                createdAt: 'dateCreated',
                deletedAt: 'dateRemoved',
                paranoid: true,
                freezeTableName: true
            })
        }
    },
    postSettings: ({Client,Address,ClientAddress,ClientPhone,ClientCustomField,CustomField, ClientGroup,Request}) => {
        Client.hasMany(ClientAddress, {as: 'clientAddresses', foreignKey: 'clientId'});
        Client.belongsToMany(Address, {through: ClientAddress, as: 'addresses', foreignKey: 'clientId'});

        Client.hasMany(ClientPhone, {as: 'clientPhones', foreignKey: 'clientId'});

        Client.belongsTo(ClientGroup, {as: 'clientGroup', foreignKey: 'clientGroupId'});
        
        Client.hasMany(ClientCustomField, {as: 'clientCustomFields', foreignKey: 'clientId'});
        Client.belongsToMany(CustomField, { through: ClientCustomField, as: 'customFields', foreignKey: 'clientId' });

        Client.hasMany(Request, {as: 'clientRequest', foreignKey: 'clientId'})
    }
}
