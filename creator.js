function createBankWithCreditorsLib (execlib, leveldbbanklib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    Bank = leveldbbanklib.Bank,
    BankWithCreditorsMixin = require('./mixincreator')(execlib, Bank);

  function BankWithCreditors (prophash) {
    Bank.call(this, prophash);
    BankWithCreditorsMixin.call(this, prophash);
  }
  lib.inherit(BankWithCreditors, Bank);
  BankWithCreditorsMixin.addMethods(BankWithCreditors);
  BankWithCreditors.prototype.destroy = function () {
    BankWithCreditorsMixin.prototype.destroy.call(this);
    Bank.prototype.destroy.call(this);
  };

  return q({
    BankWithCreditorsMixin: BankWithCreditorsMixin,
    BankWithCreditors: BankWithCreditors
  });
};

module.exports = createBankWithCreditorsLib;
