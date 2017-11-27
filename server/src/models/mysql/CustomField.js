module.exports = {
    defineModel: (Sequelize, sequelize) => {
        const modelName = 'CustomField';
        return {
            name: modelName,
            instance: sequelize.define('customField', {
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
                    allowNull: false
                },
                dateUpdated: {
                    type: Sequelize.DATE
                },
                dateCreated: {
                    type: Sequelize.DATE
                },
                dateRemoved: {
                    type: Sequelize.DATE
                }
            }, {
                tableName: 'custom_field',
                timestamps: true,
                updatedAt: 'dateUpdated',
                createdAt: 'dateCreated',
                deletedAt: 'dateRemoved',
                paranoid: true,
                freezeTableName: true
            })
        }
    },
    postSettings: ({CustomField, Client, ClientCustomField}) => {
        CustomField.belongsToMany(Client, {through: ClientCustomField, as: 'customFieldClients', foreignKey: 'customFieldId'});
    }
};