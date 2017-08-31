'use strict';
module.exports = function(sequelize, DataTypes) {
  var Citizen = sequelize.define('Citizen', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    discord_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    reclaiming: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    code: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Citizen;
};
