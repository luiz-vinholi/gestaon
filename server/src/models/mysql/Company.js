module.exports = {
    defineModel: (Sequelize, sequelize) => {
        const modelName = 'Company';
        return {
            name: modelName,
            instance: sequelize.define(modelName, {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                name: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    validate: {
                        len: {
                            args: [3, 20],
                            msg: "O nome da empresa deve possuir entre 5 a 20 dígitos."
                        }
                    },
                    set(val) {
                        this.setDataValue('name', (val == '' | val == null) ? null : val.toUpperCase().trim());
                    }
                },
                dateUpdated: {
                    type: Sequelize.DATE,
                    field: 'date_updated'
                },
                dateCreated: {
                    type: Sequelize.DATE,
                    field: 'date_created'
                },
                dateRemoved: {
                    type: Sequelize.DATE,
                    field: 'date_removed'
                },
                status: {
                    type: Sequelize.STRING,
                    defaultValue: 'activated'
                }
            }, {
                tableName: "company",
                timestamps: true,
                updatedAt: 'dateUpdated',
                createdAt: 'dateCreated',
                deletedAt: 'dateRemoved',
                paranoid: true,
                freezeTableName: true
            })
        }
    },
    postSettings: ({Company, Device, CompanyUser, User, CompanySetting}) => {
        Company.belongsToMany(User, {through: CompanyUser, as: 'users', foreignKey: 'companyId'});
        Company.hasMany(CompanyUser, {as: 'companyUsers', foreignKey: 'companyId'});
        Company.hasMany(Device, {as: 'devices', foreignKey: 'companyId'});
        Company.hasMany(CompanySetting,  {as: 'companySettings', foreignKey: 'companyId'});
    }
}
