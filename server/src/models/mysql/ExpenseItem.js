module.exports = {
    defineModel: (Sequelize, sequelize) => {
        const modelName = 'ExpenseItem';
        return {
            name: modelName,
            instance: sequelize.define(modelName, {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                companyId: {
                    type: Sequelize.INTEGER
                },
                expenseGroupId: {
                    type: Sequelize.INTEGER
                },
                name: {
                    type: Sequelize.STRING,
                    set(val) {
                        this.setDataValue('name', (val == '' | val == null) ? null : val.toUpperCase().trim());
                    }
                },
                dateUpdated: {
                    type: Sequelize.DATE,
                    default: null
                },
                dateCreated: {
                    type: Sequelize.DATE
                },
                dateRemoved: {
                    type: Sequelize.DATE,
                    default: null
                },
                status: {
                    type: Sequelize.STRING,
                    default: 'activated'
                }
            }, {
                tableName: "expense_item",
                timestamps: true,
                updatedAt: 'dateUpdated',
                createdAt: 'dateCreated',
                deletedAt: 'dateRemoved',
                paranoid: true,
                freezeTableName: true
            })
        }
    },
    postSettings: ({ }) => {
    }
}