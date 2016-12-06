function createBankWithCreditorsMixin (execlib, Bank) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    _creditorsuffix = '_creditor',
    _debtsuffix = '_debt',
    _creditorsuffixlength = _creditorsuffix.length;


  function BankWithCreditorsMixin (prophash) {
  };
  BankWithCreditorsMixin.prototype.destroy = function () {
  };

  BankWithCreditorsMixin.prototype.superCharge = function (username, amount, referencearry) {
    return Bank.prototype.charge.call(this, username, amount, referencearry);
  };

  BankWithCreditorsMixin.prototype.readCreditor = function (username) {
    return this.readAccountWDefault(username+_creditorsuffix, 0);
  };

  BankWithCreditorsMixin.prototype.readDebt = function (username) {
    console.log('readDebt', username, _debtsuffix);
    return this.readAccountWDefault(username+_debtsuffix, 0);
  };

  BankWithCreditorsMixin.prototype.chargeCreditor = function(username, amount, referencearry) {
    return this.superCharge(username+_creditorsuffix, amount, referencearry);
  };

  BankWithCreditorsMixin.prototype.chargeDebt = function(username, amount, referencearry) {
    return this.superCharge(username+_debtsuffix, amount, referencearry);
  };

  BankWithCreditorsMixin.prototype.readAccount = function (username) {
    return q.all([
      this.readAccountWDefault(username, 0),
      this.readCreditor(username)
    ]).spread(
      accountSummer.bind(null)
    );
  };

  function accountSummer (mymoney, creditormoney) {
    return q(mymoney+creditormoney);
  };

  BankWithCreditorsMixin.prototype.readBoth = function (username, cb) {
    return q.all([
      this.readAccountWDefault(username, 0),
      this.readCreditor(username)
    ]).spread(cb);
  };

  BankWithCreditorsMixin.prototype.readAll = function (username, cb) {
    return q.all([
      this.readAccountWDefault(username, 0),
      this.readCreditor(username),
      this.readDebt(username)
    ]).spread(cb);
  };

  BankWithCreditorsMixin.prototype.charge = function (username, amount, referencearry) {
    try {
      //console.log('charge!, username', username, 'amount', amount);
    if (amount>0) {
      return this.locks.run(username+'--chargecombo--', new qlib.PromiseChainerJob([
        this.readBoth.bind(this, username, this.accountChecker.bind(this, username, amount, referencearry))
      ]));
    }
    return this.locks.run(username+'--chargecombo--', new qlib.PromiseChainerJob([
      this.readCreditor.bind(this, username),
      this.creditorAccountChecker.bind(this, username, amount, referencearry)
    ])); 
    } catch(e) {
      console.error(e.stack);
      console.error(e);
    }
  };

  BankWithCreditorsMixin.prototype.accountChecker = function (username, amount, referencearry, money, creditormoney) {
    //console.log('accountChecker, username', username, 'amount', amount, 'account', account, 'creditoraccount', creditoraccount);
    var ops, fromcreditor, fromdebt;
    if (money < amount) {
      fromcreditor = amount - money;
      if (fromcreditor > creditormoney) {
        fromcreditor = creditormoney;
      }
      fromdebt = amount - money - fromcreditor;
      ops = [];
      if (money) {
        ops.push(this.superCharge(username, money, referencearry));
      };
      if (fromcreditor > 0) {
        ops.push(this.chargeCreditor(username, fromcreditor, referencearry));
        ops.push(this.chargeDebt(username, -fromcreditor, referencearry));
      }
      if (fromdebt > 0) {
        ops.push(this.chargeDebt(username, -fromdebt, referencearry));
      }
      return q.all(ops).spread(
        this.outMoneyChargeSummer.bind(this)
      );
    }
    return this.superCharge(username, amount, referencearry);
  };

  BankWithCreditorsMixin.prototype.creditorAccountChecker = function (username, amount, referencearry, creditormoney) {
    try {
    var creditormoney = creditormoney;
    if (creditormoney < -amount) {
      if (creditormoney) {
        return q.all([
          this.chargeCreditor(username, creditormoney, referencearry),
          this.superCharge(username, amount, referencearry)
        ]).spread(
          this.inMoneyChargeSummer.bind(this)
        );
      } else {
        return this.superCharge(username, amount, referencearry);
      }
    }
    return q.all([
      this.chargeCreditor(username, -amount, referencearry),
      this.superCharge(username, amount, referencearry)
    ]).spread(
      this.inMoneyChargeSummer.bind(this)
    );
    } catch(e) {
      console.error(e.stack);
      console.error(e);
    }
  };

  BankWithCreditorsMixin.prototype.outMoneyChargeSummer = function (mycharge, creditorcharge) {
    console.log('outMoneyChargeSummer', mycharge, creditorcharge);
    var ret = 0;
    if (lib.isArray(mycharge) && mycharge.length>1) {
      ret += mycharge[1];
    }
    if (lib.isArray(creditorcharge) && creditorcharge.length>1) {
      ret += creditorcharge[1];
    }
    return q(ret);
  };

  BankWithCreditorsMixin.prototype.inMoneyChargeSummer = function (creditorcharge, mycharge) {
    console.log('inMoneyChargeSummer', creditorcharge, mycharge);
    var ret = 0;
    if (lib.isArray(mycharge) && mycharge.length>1) {
      ret += mycharge[1];
    }
    if (lib.isArray(creditorcharge) && creditorcharge.length>1) {
      ret += creditorcharge[1];
    }
    return q(ret);
  };
  
  BankWithCreditorsMixin.prototype.ensure = function (username, amount, referencearry) {
    if (amount < 0) {
      return q.reject(new lib.Error('AMOUNT_FOR_ENSURE_CANNOT_BE_NEGATIVE', amount));
    }
    return this.readBoth(username, this.onAccountForEnsure.bind(this, username, amount, referencearry));
  };

  BankWithCreditorsMixin.prototype.onAccountForEnsure = function (username, amount, referencearry, mymoney, creditormoney) {
    var totalmoney = mymoney + creditormoney,
      missing = amount-totalmoney,
      ops = [];
    console.log('onAccountForEnsure', arguments);
    console.log('onAccountForEnsure', amount, mymoney, creditormoney, 'missing', missing);
    if (missing > 0) {
      ops.push(this.chargeCreditor(username, -missing, referencearry));
    }
    if (missing < 0) {
      if (-missing < creditormoney) {
        ops.push(this.chargeCreditor(username, -missing, referencearry));
      } else {
        ops.push(this.chargeCreditor(username, creditormoney, referencearry));
      }
    }
    if (ops.length) {
      return q.all(ops).then(qlib.returner(amount));
    } else {
      return q(amount);
    }
  };

  BankWithCreditorsMixin.prototype.estimate = function (username, amountdelta) {
    return q.all([
      this.readAccountWDefault(username, 0),
      this.readCreditor(username)
    ]).spread(
      estimator.bind(this, amountdelta)
    );
  };

  function estimator (amountdelta, mymoney, creditormoney) {
    var extra = amountdelta - creditormoney;
    if (amountdelta < creditormoney) {
      return creditormoney + mymoney;
    }
    return mymoney + amountdelta;
  };

  function isBankWithCreditorAccount (item) {
    return (item && item.key && item.key.substr && item.key.substr(-_creditorsuffixlength) !== _creditorsuffix);
  }

  BankWithCreditorsMixin.prototype.traverseAccounts = function (options) {
    options = options || {};
    options.filter = isBankWithCreditorAccount;
    return this.accounts.traverse(options);
  };
  
  BankWithCreditorsMixin.addMethods = function (klass) {
    lib.inheritMethods(klass, BankWithCreditorsMixin,
      'superCharge',
      'readCreditor',
      'readDebt',
      'chargeCreditor',
      'chargeDebt',
      'readAccount',
      'readBoth',
      'readAll',
      'charge',
      'accountChecker',
      'creditorAccountChecker',
      'outMoneyChargeSummer',
      'inMoneyChargeSummer',
      'ensure',
      'onAccountForEnsure',
      'estimate',
      'isAccount',
      'traverseAccounts'
    );
  };

  return BankWithCreditorsMixin;
};

module.exports = createBankWithCreditorsMixin;
