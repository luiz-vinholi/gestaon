import Sequelize from 'sequelize'
import _ from 'lodash'

module.exports = {
    defineModel: (server) => {
        const TIMESTAMP = require('sequelize-mysql-timestamp')(server.sequelize);
        const modelName = 'ClientPhone';
        return {
            name: modelName,
            instance: server.sequelize.define(_.camelCase(modelName), {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                clientId: {
                    type: Sequelize.INTEGER
                },
                number: {
                    type: Sequelize.STRING,
                    validate: {
                        isValidPhoneNumber(value){
                            if(parseInt(value) <= 999999999 || parseInt(value) > 99999999999){
                                throw new Error('Número de telefone/celular inválido!');
                            }
                        }
                    }
                },
                name: {
                    type: Sequelize.STRING,
                    set(val){
                        this.setDataValue('name', (!val) ? null : val.toUpperCase().trim());
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
                }
            }, {
                tableName: 'client_phone',
                timestamps: true,
                updatedAt: 'dateUpdated',
                createdAt: 'dateCreated',
                deletedAt: 'dateRemoved',
                paranoid: true,
                freezeTableName: true
            })
        }
    },
    postSettings: ({ClientPhone, Client}) => {
        ClientPhone.belongsTo(Client, {as: 'client', foreignKey: 'clientId'});
    }
};
