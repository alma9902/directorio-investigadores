'use strict';
module.exports = (sequelize, DataTypes) => {
  const TelefonoInstitucion = sequelize.define('TelefonoInstitucion', {
    telefono: DataTypes.INTEGER
  }, {
    freezeTableName: true,
  });
  TelefonoInstitucion.associate = function(models) {
    TelefonoInstitucion.belongsTo(models.Institucion, {
        foreignKey: 'id_institucion',
        as: 'institucion',
    });
  };
  return TelefonoInstitucion;
};